const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const storageService = require('./storage.service');
const membershipService = require('./membership.service');
const kycService = require('./kyc.service');
const { sniffMime, CV_TYPES } = require('../utils/mime');
const { cvTemplate } = require('../utils/templates/cv.template');
const { renderPdf } = require('../utils/pdfRenderer');

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function extractText(buffer, mime) {
  if (mime === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    return result.text || '';
  }
  if (mime === DOCX_MIME) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  return '';
}

// Heuristic structured extraction. Swap this for a resume-parsing API or an
// LLM extraction call without touching anything upstream — the applicant
// always reviews/edits the result before it is saved to their KYC form.
function extractStructured(text) {
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/) || [null])[0];
  const phone = (text.match(/(?:\+977[-\s]?)?9\d{9}/) || [null])[0];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headerPatterns = {
    summary: /^(professional\s+)?(summary|objective|profile|about)/i,
    experience: /^(work\s+)?(experience|employment)/i,
    education: /^(education|academic)/i,
    skills: /^(technical\s+)?(skills|competencies|expertise)/i,
    projects: /^projects?/i,
    certifications: /^(certifications?|licenses?|trainings?)/i,
  };

  const sections = {};
  let current = 'summary';
  for (const line of lines) {
    const matched =
      line.length < 45 &&
      Object.entries(headerPatterns).find(([, re]) => re.test(line));
    if (matched) {
      current = matched[0];
      sections[current] = sections[current] || [];
      continue;
    }
    (sections[current] = sections[current] || []).push(line);
  }

  const skills = (sections.skills || [])
    .join(' ')
    .split(/[,•|·;]/)
    .map((s) => s.trim())
    .filter((s) => s && s.length < 40)
    .slice(0, 30);

  return {
    email,
    phone,
    skills,
    sections: Object.fromEntries(
      Object.entries(sections).map(([k, v]) => [k, v.join('\n').slice(0, 4000)])
    ),
  };
}

async function withSignedUrl(cvDocument) {
  return {
    ...cvDocument,
    fileUrl: await storageService.getSignedUrl(cvDocument.fileUrl),
  };
}

async function uploadCv(userId, file) {
  await kycService.assertKycEditable(userId);
  const profile = await kycService.ensureProfile(userId);

  const mime = sniffMime(file.buffer);
  if (!CV_TYPES.includes(mime)) {
    throw ApiError.unprocessable('CV must be a PDF or DOCX file', 'BAD_FILE_TYPE');
  }

  const key = storageService.makeKey('cv', file.originalname);
  await storageService.putObject(key, file.buffer, mime);

  let parsedData = null;
  try {
    const text = await extractText(file.buffer, mime);
    parsedData = extractStructured(text);
  } catch (err) {
    console.error('[cv-parse]', err.message);
  }

  const cvDocument = await prisma.cvDocument.create({
    data: {
      memberProfileId: profile.id,
      sourceType: 'UPLOADED',
      fileUrl: key,
      parsedData,
    },
  });

  const completionPercent = await membershipService.recalculateCompletion(userId);
  return { cv: await withSignedUrl(cvDocument), completionPercent };
}

async function reparseCv(userId, cvId) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  const cvDocument =
    profile &&
    (await prisma.cvDocument.findFirst({
      where: { id: cvId, memberProfileId: profile.id, sourceType: 'UPLOADED' },
    }));
  if (!cvDocument || !cvDocument.fileUrl) {
    throw ApiError.notFound('Uploaded CV not found');
  }

  const buffer = await storageService.getObjectBuffer(cvDocument.fileUrl);
  const mime = sniffMime(buffer);
  const text = await extractText(buffer, mime);
  const parsedData = extractStructured(text);

  const updated = await prisma.cvDocument.update({
    where: { id: cvDocument.id },
    data: { parsedData },
  });
  return withSignedUrl(updated);
}

async function listMyCvs(userId) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile) return [];
  const docs = await prisma.cvDocument.findMany({
    where: { memberProfileId: profile.id },
    orderBy: { createdAt: 'desc' },
    include: { template: { select: { id: true, name: true } } },
  });
  return Promise.all(docs.map(withSignedUrl));
}

async function listTemplates() {
  const templates = await prisma.cvTemplate.findMany({ orderBy: { name: 'asc' } });
  return Promise.all(
    templates.map(async (t) => ({
      ...t,
      previewImageUrl:
        t.previewImageUrl && !t.previewImageUrl.startsWith('data:')
          ? await storageService.getSignedUrl(t.previewImageUrl)
          : t.previewImageUrl,
    }))
  );
}

async function generateCv(userId, { templateId, content = {} }) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      ictDomain: true,
      addresses: true,
      educationDetail: true,
      employmentDetail: true,
    },
  });
  if (!profile) throw ApiError.badRequest('Complete your profile first', 'NO_PROFILE');

  const template = templateId
    ? await prisma.cvTemplate.findUnique({ where: { id: templateId } })
    : await prisma.cvTemplate.findFirst();
  if (!template) throw ApiError.notFound('CV template not found');

  const application = await membershipService.getActiveApplication(userId);
  const permanent = profile.addresses.find((a) => a.type === 'PERMANENT');

  // The builder reuses KYC data; `content` carries the CV-specific extras
  // (summary, skills, experience list) from the builder UI.
  const data = {
    fullName:
      content.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    headline:
      content.headline ||
      (profile.employmentDetail &&
        [profile.employmentDetail.designation, profile.employmentDetail.organizationName]
          .filter(Boolean)
          .join(' · ')) ||
      (profile.ictDomain && profile.ictDomain.name),
    email: content.email || profile.user.email,
    phone: content.phone || profile.mobileNumber || profile.user.phoneNumber,
    address: permanent
      ? `${permanent.tole}, ${permanent.municipality}-${permanent.wardNumber}, ${permanent.district}`
      : null,
    socialProfileUrl: profile.socialProfileUrl,
    summary: content.summary,
    skills: content.skills || [],
    experience:
      content.experience && content.experience.length
        ? content.experience
        : profile.employmentDetail && profile.employmentDetail.organizationName
          ? [
              {
                title: profile.employmentDetail.designation || 'Staff',
                organization: profile.employmentDetail.organizationName,
                period: 'Present',
                description: '',
              },
            ]
          : [],
    education:
      content.education && content.education.length
        ? content.education
        : profile.educationDetail
          ? [
              {
                qualification: profile.educationDetail.highestQualification,
                institution: profile.educationDetail.institutionName,
                fieldOfStudy: profile.educationDetail.fieldOfStudy,
              },
            ]
          : [],
    category: application ? application.category : 'GENERAL',
    orgName: 'UNICTS',
  };

  const html = cvTemplate({ data, schema: template.templateSchema || {} });
  const pdfBuffer = await renderPdf(html, { format: 'A4' });

  const key = storageService.makeKey('cv', `generated-${Date.now()}.pdf`);
  await storageService.putObject(key, Buffer.from(pdfBuffer), 'application/pdf');

  const cvDocument = await prisma.cvDocument.create({
    data: {
      memberProfileId: profile.id,
      sourceType: 'GENERATED',
      fileUrl: key,
      templateId: template.id,
      parsedData: { builder: data },
    },
  });

  const completionPercent = await membershipService.recalculateCompletion(userId);
  return { cv: await withSignedUrl(cvDocument), completionPercent };
}

module.exports = {
  uploadCv,
  reparseCv,
  listMyCvs,
  listTemplates,
  generateCv,
  extractStructured,
};
