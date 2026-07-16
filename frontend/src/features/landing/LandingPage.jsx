import { Link } from 'react-router-dom';
import {
  IdCard,
  ClipboardCheck,
  FileText,
  CalendarDays,
  GraduationCap,
  Newspaper,
} from 'lucide-react';

const FEATURES = [
  {
    icon: IdCard,
    title: 'Digital ID Card',
    text: 'Approved members receive a QR-verified digital identity card, downloadable anytime.',
  },
  {
    icon: ClipboardCheck,
    title: 'Online KYC/KYM',
    text: 'A guided, step-by-step application with progress tracking — save and resume anytime.',
  },
  {
    icon: FileText,
    title: 'CV Upload & Builder',
    text: 'Upload an existing CV or build a professional one from your profile in minutes.',
  },
  {
    icon: CalendarDays,
    title: 'Events & Calendar',
    text: 'See society events in-app and sync them straight to your Google Calendar.',
  },
  {
    icon: GraduationCap,
    title: 'Certifications',
    text: 'Training and course certifications issued by UNICTS, all in one place.',
  },
  {
    icon: Newspaper,
    title: 'Newsletters',
    text: 'Stay current with society news, publications, and announcements.',
  },
];

const STEPS = [
  ['Choose category', 'General or Institutional membership'],
  ['Sign up & verify', 'OTP by SMS or email'],
  ['Complete KYC', 'Profile, documents, and CV'],
  ['Get your ID card', 'Admin approval issues your digital card'],
];

export default function LandingPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy via-[#14417b] to-brand-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            The membership home of Nepal's ICT community
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
            Apply online, verify your identity, and receive a QR-verified digital
            member ID — then stay engaged with events, certifications, and news.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/apply"
              className="btn bg-white px-6 py-3 text-navy hover:bg-slate-100"
            >
              Apply for membership
            </Link>
            <Link
              to="/login"
              className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10"
            >
              Member login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Everything a member needs
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <f.icon className="h-8 w-8 text-brand-700" />
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">How it works</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link to="/apply" className="btn-primary px-6 py-3">
              Start your application
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
