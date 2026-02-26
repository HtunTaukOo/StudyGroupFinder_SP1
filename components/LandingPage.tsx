
import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Shield, ArrowRight, CheckCircle2, Sun, Moon, UserPlus, Search, CalendarCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const LandingPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-orange-100">AU</div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-slate-900 leading-none tracking-tight">StudyHub</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Study Group Finder</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-bold text-slate-500 hover:text-slate-900">Features</a>
          <a href="#how" className="text-sm font-bold text-slate-500 hover:text-slate-900">How it works</a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-700"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/login" className="text-sm font-bold text-slate-600 px-5 py-2 hover:bg-slate-100 rounded-xl transition-all">Login</Link>
          <Link to="/signup" className="bg-orange-500 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all">Sign Up</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 md:px-12 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-100 rounded-full text-orange-600 text-xs font-black uppercase tracking-widest">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            Built for Students by Students
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight">
            Study better, <br/> <span className="text-orange-500">together.</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-lg">
            Find classmates, join study groups, and ace your exams. AU StudyHub connects you with the right people for every subject.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-200 hover:bg-orange-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
              Get Started <ArrowRight size={18} />
            </Link>
            <div className="flex -space-x-3 px-4">
              {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200"></div>)}
              <div className="w-10 h-10 rounded-full border-4 border-white bg-orange-500 text-white flex items-center justify-center text-[10px] font-black">+2k</div>
            </div>
            <span className="text-sm font-bold text-slate-400">Join 2,000+ students online</span>
          </div>
          
          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
              <CheckCircle2 className="text-orange-500" /> Real classmates
            </div>
            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
              <CheckCircle2 className="text-orange-500" /> Faculty filtered
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/10 blur-[100px] rounded-full"></div>
          <div className="relative bg-white border border-slate-200 rounded-[3rem] p-4 shadow-2xl">
            <img src="https://www.u-fukui.ac.jp/wp/wp-content/uploads/Assumption-Campus.jpg" className="rounded-[2.5rem] w-full h-auto opacity-90" alt="Study Group" />
            <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-bounce duration-[3000ms]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Join Now</span>
              </div>
              <p className="font-bold text-slate-900">Calc III Study Room</p>
              <div className="flex mt-3">
                {[1,2,3].map(i => <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 -ml-2 first:ml-0"></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 md:px-12 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black text-slate-900">Everything you need to succeed</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">A specialized toolset designed to make collaborative learning effortless and productive.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Users className="text-orange-500" />, title: 'Smart Groups', desc: 'Join groups limited by seats to ensure focused and high-quality study sessions.' },
              { icon: <BookOpen className="text-blue-500" />, title: 'AI Study Assistant', desc: 'Use Gemini-powered chat summaries and auto-generated study descriptions.' },
              { icon: <Shield className="text-emerald-500" />, title: 'Verified Profiles', desc: 'Only university students with valid emails can join our verified community.' }
            ].map((f, idx) => (
              <div key={idx} className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 hover:border-orange-200 transition-all hover:bg-white hover:shadow-xl hover:shadow-orange-50/50 group text-center">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-110 transition-all">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 px-6 md:px-12 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black text-slate-900">How it works</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">
              Create your profile, discover your classmates, and start focused group sessions in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <UserPlus className="text-orange-500" />,
                title: '1. Sign up with your AU email',
                desc: 'Create an account, set your major and profile, then verify your student email to join the trusted community.'
              },
              {
                icon: <Search className="text-blue-500" />,
                title: '2. Find or create a study group',
                desc: 'Browse by subject, faculty, and schedule. If a group does not exist, create one and invite classmates.'
              },
              {
                icon: <CalendarCheck className="text-emerald-500" />,
                title: '3. Meet, study, and track progress',
                desc: 'Join sessions, share updates in group chat, and build consistency with regular meetings and activity.'
              }
            ].map((item, idx) => (
              <div key={idx} className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 px-6 md:px-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="bg-orange-50 border border-orange-100 rounded-3xl p-8 text-center">
            <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-2">Need help?</p>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Contact Admin Support</h3>
            <p className="text-slate-500 font-medium mb-4">For account issues, access requests, or moderation concerns.</p>
            <a
              href="mailto:studyhub.studygroupfinder@gmail.com"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange-500 text-white font-black text-sm uppercase tracking-widest hover:bg-orange-600 transition-all"
            >
              studyhub.studygroupfinder@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">© 2026 AU Study Group Finder • Built with ♥ for students</p>
      </footer>
    </div>
  );
};

export default LandingPage;
