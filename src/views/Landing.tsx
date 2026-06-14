import React from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Wrench, CreditCard, ShieldCheck, ChevronRight, X, BookOpen, Sun, Moon, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils';

interface LandingProps {
  onGetQuote: () => void;
  onMechanicPortal: () => void;
}

const BLOG_POSTS = [
  {
    id: 'servicing-101',
    tag: 'First Car',
    title: 'Car Servicing 101',
    subtitle: 'What no one told you when you got your licence.',
    readTime: '4 min',
    content: [
      {
        type: 'p',
        text: 'You passed your test. You\'ve got the keys. And then someone says "have you serviced it lately?" and you nod confidently while having absolutely no idea what that means. Don\'t worry — most people don\'t. Here\'s everything you need to know.',
      },
      { type: 'h2', text: 'What even is a car service?' },
      {
        type: 'p',
        text: 'A service is a scheduled health check for your car. A mechanic goes through a checklist of the key systems — oil, filters, fluids, brakes, tyres — and replaces or flags anything that\'s worn or about to wear. It\'s the difference between your car running smoothly at 200,000km and it leaving you stranded at 90,000km.',
      },
      { type: 'h2', text: 'How often does my car need one?' },
      {
        type: 'p',
        text: 'The standard rule is every 10,000km or once a year, whichever comes first. Some newer cars push to 15,000km, but older vehicles (pre-2010) often need more frequent attention. Your owner\'s manual has the manufacturer\'s recommendation — but when in doubt, annual is the safe bet.',
      },
      { type: 'h2', text: 'Standard Service vs Full Service — what\'s the difference?' },
      {
        type: 'p',
        text: 'A Standard Service covers the essentials: oil and filter change, fluid top-ups, tyre pressure check, and a general safety inspection. A Full Service goes deeper — air filter, drive belt visual check, cooling system, battery test, and a test drive report. If you\'ve just bought a second-hand car, go full. Otherwise, alternating is fine.',
      },
      { type: 'h2', text: 'What\'s a WOF and is it the same thing?' },
      {
        type: 'p',
        text: 'No — and this trips up almost every new driver. A Warrant of Fitness checks that your car is safe enough to be on the road right now: lights, tyres, brakes, steering, windscreen. It does not change your oil, replace worn parts, or flag what\'s about to fail. You need both, for different reasons.',
      },
      { type: 'h2', text: 'What happens if I skip a service?' },
      {
        type: 'p',
        text: 'Old oil breaks down and stops lubricating the engine properly — leading to accelerated wear that can cost thousands to fix. Worn brake pads eat into rotors. Filters clog. Small problems become expensive ones. A service is always cheaper than the thing it prevents.',
      },
      { type: 'h2', text: 'Signs your car is telling you something\'s wrong' },
      {
        type: 'list',
        items: [
          'Dashboard warning lights — never ignore these, even if the car seems fine',
          'Rough idle or hesitation when you accelerate',
          'Unusual smells: burning oil, sweetness (coolant), or raw fuel',
          'Vibration through the steering wheel at speed',
          'Louder or rougher than normal when starting from cold',
        ],
      },
      {
        type: 'cta',
        text: 'Get an instant quote for your car on Torqued. Pick a verified workshop, book it, and get on with your life.',
      },
    ],
  },
  {
    id: 'transmission-service',
    tag: 'Under the Hood',
    title: 'The Gearbox: The Part of Your Car You\'ve Never Thought About',
    subtitle: 'Until it fails. And by then, it\'s very expensive.',
    readTime: '5 min',
    content: [
      {
        type: 'p',
        text: 'Most people know they need to change their oil. Far fewer know their gearbox needs servicing too — and the consequences of skipping it are significantly more expensive.',
      },
      { type: 'h2', text: 'What does the transmission actually do?' },
      {
        type: 'p',
        text: 'The transmission (or gearbox) transfers power from the engine to the wheels. Without it, your engine would rev but the car wouldn\'t move. Whether you drive a manual or automatic, your gearbox is working every single time you\'re behind the wheel.',
      },
      { type: 'h2', text: 'Manual vs automatic — does the service differ?' },
      {
        type: 'p',
        text: 'Manual gearboxes use gear oil that degrades over time. Automatics use transmission fluid, which also breaks down — and if neglected, starts causing slipping, harsh shifts, or full failure. DSG (Direct Shift Gearbox) and CVT transmissions, common in modern VW, Audi, Honda, and Toyota models, are even more sensitive. They have specific fluid requirements and mechatronic components that cheap fluid or missed services can permanently damage.',
      },
      { type: 'h2', text: 'How often does it need servicing?' },
      {
        type: 'p',
        text: 'Most manufacturers recommend every 40,000–60,000km for automatics, or every 30,000–40,000km for manuals. Some modern sealed automatics claim "lifetime" fluid — but experienced mechanics widely disagree with this. If your car is over 80,000km and has never had the gearbox oil changed, it\'s due.',
      },
      { type: 'h2', text: 'Signs your transmission is struggling' },
      {
        type: 'list',
        items: [
          'Hesitation or delay when shifting gears (especially drive to first)',
          'Shuddering or jerking, particularly at low speeds',
          'A burning smell from under the car after driving',
          'Difficulty finding gears on a manual',
          '"Transmission Fault" or "Gearbox Overtemp" warning on the dash',
        ],
      },
      { type: 'h2', text: 'What does it cost to ignore it?' },
      {
        type: 'p',
        text: 'A transmission service is one of the best-value preventative services on any car. A transmission rebuild or full replacement? Typically $3,000–$8,000+, depending on the vehicle. It\'s one of the most skipped services — and one of the most consequential to miss.',
      },
      {
        type: 'cta',
        text: 'Book a transmission service through Torqued. Get an instant quote, pick a specialist workshop, and protect one of the most expensive components in your car.',
      },
    ],
  },
];

const SUGGESTED_POSTS = [
  { tag: 'Basics', title: 'WOF vs Service: What\'s the Difference?', desc: 'Two different things that most people confuse. Here\'s exactly what each one covers.' },
  { tag: 'Engine', title: 'Why Engine Oil Actually Matters', desc: 'It\'s not just "black stuff you top up." Here\'s what oil does and why old oil is a real problem.' },
  { tag: 'Timing', title: 'Timing Belt vs Timing Chain: Know Before It\'s Too Late', desc: 'One can snap without warning. The other lasts the life of the engine. Do you know which your car has?' },
  { tag: 'EV', title: 'Electric vs Petrol Servicing: What Changes, What Doesn\'t', desc: 'EVs still need servicing. Here\'s what\'s different and what remains the same.' },
  { tag: 'Safety', title: 'What Happens During a Brake Pad Replacement', desc: 'A step-by-step breakdown so you know exactly what you\'re paying for — and why it matters.' },
];

type BlogPost = typeof BLOG_POSTS[0];

function BlogArticle({ post, onClose, onGetQuote }: { post: BlogPost; onClose: () => void; onGetQuote: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-foreground/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <motion.article
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-background border border-border rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-border flex justify-between items-start gap-4">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-torqued-red bg-torqued-red/10 px-2 py-1 rounded-full">{post.tag}</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground leading-tight">{post.title}</h1>
            <p className="text-muted text-sm">{post.subtitle} · {post.readTime} read</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-card rounded-full transition-all shrink-0 text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-5">
          {post.content.map((block, i) => {
            if (block.type === 'h2') return (
              <h2 key={i} className="text-lg font-black text-foreground tracking-tight pt-3">{block.text}</h2>
            );
            if (block.type === 'p') return (
              <p key={i} className="text-muted leading-relaxed text-[15px]">{block.text}</p>
            );
            if (block.type === 'list') return (
              <ul key={i} className="space-y-2">
                {block.items?.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-muted text-[14px]">
                    <span className="text-torqued-red mt-1 shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            );
            if (block.type === 'cta') return (
              <div key={i} className="mt-6 p-5 bg-torqued-red/10 border border-torqued-red/20 rounded-2xl space-y-3">
                <p className="text-foreground text-sm leading-relaxed">{block.text}</p>
                <button
                  onClick={onGetQuote}
                  className="inline-flex items-center gap-2 bg-torqued-red text-white text-sm font-black px-5 py-2.5 rounded-xl hover:bg-torqued-red/90 transition-all"
                >
                  Get a Free Quote <ChevronRight size={14} />
                </button>
              </div>
            );
            return null;
          })}
        </div>
      </motion.article>
    </motion.div>
  );
}

export const Landing: React.FC<LandingProps> = ({ onGetQuote, onMechanicPortal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [openPost, setOpenPost] = React.useState<BlogPost | null>(null);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      {/* Navigation */}
      <nav className="p-4 md:px-8 flex justify-between items-center bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <Logo variant={theme === 'dark' ? 'light' : 'dark'} />
        <div className="hidden md:flex gap-4 items-center">
          <div className="hidden sm:flex bg-card p-1 rounded-xl border border-border">
            {[{ name: 'light', icon: Sun }, { name: 'dark', icon: Moon }, { name: 'system', icon: Monitor }].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.name} onClick={() => setTheme(t.name as any)}
                  className={cn("p-2 rounded-lg transition-all", theme === t.name ? "bg-torqued-red text-white shadow-lg shadow-torqued-red/20" : "text-muted hover:text-foreground hover:bg-background")}>
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
          <Button size="sm" className="bg-torqued-red text-white font-bold" onClick={onGetQuote}>My Garage</Button>
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-card" onClick={onMechanicPortal}>Torqued for Workshops</Button>
        </div>
        <div className="md:hidden">
          <Button variant="ghost" size="sm" className="text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </Button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border overflow-hidden sticky top-[65px] z-40"
          >
            <div className="p-6 flex flex-col gap-4 text-center">
              <Button className="bg-torqued-red text-white w-full" onClick={onGetQuote}>My Garage</Button>
              <Button variant="outline" size="md" className="border-border text-foreground w-full" onClick={onMechanicPortal}>Torqued for Workshops</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-20 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(255,24,0,0.08)_0%,transparent_70%)] -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-tight md:leading-none font-black italic tracking-tighter text-foreground">
            Fix Your Car. <br />
            <span className="text-torqued-red">Skip the Runaround.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-2xl text-muted max-w-2xl mx-auto font-medium px-4 md:px-0">
            Instant quotes. Verified mechanics. Flexible payments. <br className="hidden md:block" />
            New Zealand's smarter way to get your car sorted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 px-6 sm:px-0">
            <Button size="lg" className="text-lg sm:text-xl bg-torqued-red text-white" onClick={onGetQuote}>Get a Free Quote</Button>
            <Button variant="outline" size="lg" className="text-lg sm:text-xl border-border text-foreground hover:bg-card" onClick={onMechanicPortal}>Torqued for Workshops</Button>
          </div>
        </motion.div>

        {/* Social Proof Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-16 flex justify-center border-y border-border py-6 w-full max-w-5xl"
        >
          <div className="font-bold text-sm italic text-torqued-red">Avg. quote in under 60 seconds</div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className="bg-card py-20 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-background border border-border rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Wrench className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Instant Quotes</h3>
            <p className="text-muted">No more ringing around. Get transparent, market-accurate pricing in seconds.</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-background border border-border rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CreditCard className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Flexible Payments</h3>
            <p className="text-muted">Afterpay, Klarna, Finance Now & more. Fix now, pay later on your terms.</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-background border border-border rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Verified Mechanics</h3>
            <p className="text-muted">Every workshop is vetted and matched to your specific car and fault type.</p>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="bg-background py-20 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-torqued-red font-black uppercase tracking-widest text-[10px]">
                <BookOpen size={12} /> Know Your Car
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground">The Torqued Read</h2>
              <p className="text-muted text-sm">Plain English car advice. No jargon, no upselling.</p>
            </div>
          </div>

          {/* Featured articles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BLOG_POSTS.map(post => (
              <button
                key={post.id}
                onClick={() => setOpenPost(post)}
                className="text-left p-6 bg-card border border-border rounded-2xl hover:border-torqued-red/30 hover:bg-card/80 transition-all group space-y-3"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-torqued-red bg-torqued-red/10 px-2 py-1 rounded-full">{post.tag}</span>
                <h3 className="text-xl font-black text-foreground leading-tight group-hover:text-torqued-red transition-colors">{post.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{post.subtitle}</p>
                <div className="flex items-center gap-1 text-torqued-red text-xs font-bold">
                  Read · {post.readTime} <ChevronRight size={13} />
                </div>
              </button>
            ))}
          </div>

          {/* Coming soon */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Coming Soon</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {SUGGESTED_POSTS.map(post => (
                <div key={post.title} className="p-4 border border-border/60 rounded-xl space-y-2 opacity-60">
                  <span className="text-[9px] font-black uppercase tracking-widest text-torqued-red">{post.tag}</span>
                  <p className="text-sm font-bold text-foreground leading-tight">{post.title}</p>
                  <p className="text-[11px] text-muted leading-relaxed">{post.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card text-foreground py-12 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo variant={theme === 'dark' ? 'light' : 'dark'} />
          <div className="text-center md:text-right">
            <p className="font-display italic text-2xl mb-2 text-foreground">MORE DRIVE. LESS HASSLE.</p>
            <p className="text-muted text-sm">© 2026 Torqued Automotive Repair Marketplace. NZ & AU.</p>
          </div>
        </div>
      </footer>

      {/* Blog article modal */}
      <AnimatePresence>
        {openPost && (
          <BlogArticle post={openPost} onClose={() => setOpenPost(null)} onGetQuote={() => { setOpenPost(null); onGetQuote(); }} />
        )}
      </AnimatePresence>
    </div>
  );
};
