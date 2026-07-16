/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const storageService = require('../src/services/storage.service');

const prisma = new PrismaClient();

const ICT_DOMAINS = [
  'Digital Banking & Fintech',
  'Urbanization & Smart Cities',
  'E-Governance',
  'Health-Tech',
  'Ed-Tech',
  'Agri-Tech',
  'Cybersecurity',
  'Cloud & Infrastructure',
  'Software Engineering',
  'Data Science & AI/ML',
  'Telecommunications',
];

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#0f2a5c"/><circle cx="64" cy="64" r="44" fill="none" stroke="#0e7490" stroke-width="6"/><text x="64" y="82" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">U</text></svg>`;

const SIGNATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><path d="M10 55 C 40 15, 60 70, 85 45 S 130 20, 150 48 S 200 65, 230 30" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/></svg>`;

const SUPER_ADMIN = {
  phoneNumber: '9800000000',
  email: 'admin@unicts.org.np',
  password: 'Admin@123!',
};

async function main() {
  // 1. Membership group
  const central = await prisma.membershipGroup.upsert({
    where: { name: 'Central' },
    create: { name: 'Central' },
    update: {},
  });

  // 2. ICT domains
  for (const name of ICT_DOMAINS) {
    await prisma.ictDomain.upsert({ where: { name }, create: { name }, update: {} });
  }

  // 3. Organization settings (placeholder logo + president signature —
  //    replace with the real assets in production)
  let org = await prisma.organizationSettings.findFirst();
  if (!org) {
    await storageService.putObject('org/logo.svg', Buffer.from(LOGO_SVG), 'image/svg+xml');
    await storageService.putObject(
      'org/president-signature.svg',
      Buffer.from(SIGNATURE_SVG),
      'image/svg+xml'
    );
    org = await prisma.organizationSettings.create({
      data: {
        orgName: 'UNICTS',
        orgLogoUrl: 'org/logo.svg',
        presidentName: 'President, UNICTS',
        presidentSignatureUrl: 'org/president-signature.svg',
      },
    });
  }

  // 4. Super admin
  const admin = await prisma.user.upsert({
    where: { phoneNumber: SUPER_ADMIN.phoneNumber },
    create: {
      phoneNumber: SUPER_ADMIN.phoneNumber,
      email: SUPER_ADMIN.email,
      passwordHash: await bcrypt.hash(SUPER_ADMIN.password, 10),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      preferredOtpChannel: 'EMAIL',
      memberProfile: { create: { firstName: 'UNICTS', lastName: 'Admin' } },
    },
    update: {},
  });

  // 5. CV templates
  const templates = [
    { name: 'Classic Teal', schema: { accentColor: '#0e7490', layout: 'classic' } },
    { name: 'Crimson Modern', schema: { accentColor: '#9f1239', layout: 'classic' } },
  ];
  for (const t of templates) {
    const existing = await prisma.cvTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.cvTemplate.create({
        data: { name: t.name, previewImageUrl: '', templateSchema: t.schema },
      });
    }
  }

  // 6. Demo content
  const demoEventTitle = 'UNICTS Annual ICT Meetup';
  if (!(await prisma.event.findFirst({ where: { title: demoEventTitle } }))) {
    const start = new Date();
    start.setDate(start.getDate() + 21);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    await prisma.event.create({
      data: {
        title: demoEventTitle,
        description:
          'The flagship annual gathering of UNICTS members — talks, networking, and the yearly general assembly.',
        startDatetime: start,
        endDatetime: end,
        location: 'Kathmandu, Nepal',
        createdById: admin.id,
      },
    });
  }

  const demoNewsletterTitle = 'Welcome to the UNICTS Member Portal';
  if (!(await prisma.newsletter.findFirst({ where: { title: demoNewsletterTitle } }))) {
    await prisma.newsletter.create({
      data: {
        title: demoNewsletterTitle,
        content:
          'The UNICTS Member Portal is live! Apply for membership, complete your KYC, and receive your digital ID card — all online. Watch this space for society news and announcements.',
        publishedById: admin.id,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  Membership group: ${central.name}`);
  console.log(`  ICT domains:      ${ICT_DOMAINS.length}`);
  console.log('  Super admin login:');
  console.log(`    phone:    ${SUPER_ADMIN.phoneNumber}`);
  console.log(`    password: ${SUPER_ADMIN.password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
