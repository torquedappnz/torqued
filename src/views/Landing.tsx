import React from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Wrench, CreditCard, ShieldCheck, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LandingProps {
  onGetQuote: () => void;
  onMechanicPortal: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetQuote, onMechanicPortal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-torqued-dark text-white">
      {/* Navigation */}
      <nav className="p-4 md:px-8 flex justify-between items-center liquid-glass-dark backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <Logo variant="light" />
        <div className="hidden md:flex gap-6 items-center">
          <button className="font-bold uppercase tracking-wider text-sm text-white/60 hover:text-torqued-red transition-colors">Log In</button>
          <button className="font-bold uppercase tracking-wider text-sm text-white/60 hover:text-torqued-red transition-colors">Sign Up</button>
          <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5" onClick={onMechanicPortal}>For Mechanics</Button>
        </div>
        <div className="md:hidden">
           <Button variant="ghost" size="sm" className="text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
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
            className="md:hidden bg-torqued-dark border-b border-white/10 overflow-hidden sticky top-[65px] z-40"
          >
            <div className="p-6 flex flex-col gap-4 text-center">
              <button className="font-bold uppercase tracking-wider text-sm text-white/60 py-2">Log In</button>
              <button className="font-bold uppercase tracking-wider text-sm text-white/60 py-2">Sign Up</button>
              <Button variant="outline" size="md" className="border-white/10 text-white w-full" onClick={onMechanicPortal}>For Mechanics</Button>
              <Button className="bg-torqued-red w-full" onClick={onGetQuote}>Get Started</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-20 text-center overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(255,24,0,0.1)_0%,transparent_70%)] -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-tight md:leading-none font-black italic tracking-tighter">
            Fix Your Car. <br />
            <span className="text-torqued-red">Skip the Runaround.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-2xl text-white/60 max-w-2xl mx-auto font-medium px-4 md:px-0">
            Instant quotes. Verified mechanics. Flexible payments. <br className="hidden md:block" />
            New Zealand's smarter way to get your car sorted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 px-6 sm:px-0">
            <Button size="lg" className="text-lg sm:text-xl bg-torqued-red" onClick={onGetQuote}>Get a Free Quote</Button>
            <Button variant="outline" size="lg" className="text-lg sm:text-xl border-white/20 text-white" onClick={onMechanicPortal}>Register Your Workshop</Button>
          </div>
        </motion.div>

        {/* Social Proof Strip */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 border-y border-white/10 py-6 w-full max-w-5xl"
        >
          <div className="flex items-center gap-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
            </div>
            <span className="font-bold text-sm">1,200+ jobs completed</span>
          </div>
          <div className="font-bold text-sm">340+ verified workshops</div>
          <div className="font-bold text-sm italic text-torqued-red">Avg. quote in under 60 seconds</div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className="bg-white/5 py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Wrench className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold">Instant Quotes</h3>
            <p className="text-white/60">No more ringing around. Get transparent, market-accurate pricing in seconds.</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CreditCard className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold">Flexible Payments</h3>
            <p className="text-white/60">Afterpay, Klarna, Finance Now & more. Fix now, pay later on your terms.</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="text-torqued-red" size={32} />
            </div>
            <h3 className="text-2xl font-bold">Verified Mechanics</h3>
            <p className="text-white/60">Every workshop is vetted and matched to your specific car and fault type.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-torqued-dark text-white py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo />
          <div className="text-center md:text-right">
            <p className="font-display italic text-2xl mb-2">MORE DRIVE. LESS HASSLE.</p>
            <p className="text-white/40 text-sm">© 2026 Torqued Automotive Repair Marketplace. NZ & AU.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
