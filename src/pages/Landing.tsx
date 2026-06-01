import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
const landingBg = "/landing-background.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, TrendingUp, Zap, Users, Lock, BarChart3 } from "lucide-react";

const Landing = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Gradient */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${landingBg}), radial-gradient(circle at 20% 90%, rgba(56, 189, 248, 0.08), transparent 20%), linear-gradient(180deg, #09131f 0%, #0f172a 100%)`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#09131f',
        }}
      />
      {/* Dark + Gold gradient overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-2 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="GWA logo"
              className="w-12 h-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-lg shadow-lg flex-shrink-0"
            />
            <span className="hidden sm:inline font-display font-semibold tracking-tight text-sm sm:text-base md:text-lg">Golden Wealth Achievers</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-4">
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Sign In</span>
              </Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gap-1 sm:gap-2 bg-gold-gradient hover:opacity-90 text-primary-foreground font-semibold shadow-lg text-xs sm:text-sm px-2 sm:px-4" style={{ boxShadow: '0 4px 20px hsl(43 65% 55% / 0.3)' }}>
                <span className="hidden sm:inline">Get Access</span>
                <span className="sm:hidden">Access</span>
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-28 md:pt-36 pb-12 sm:pb-24 px-4 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl relative">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gold/20 bg-card/80 backdrop-blur-sm mb-10 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm text-muted-foreground">Save Smart. Invest Secure. Trade Safely</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter leading-[0.9] mb-8 animate-fade-in-up font-display">
              <span className="text-gradient-gold">Growth.</span>
              <br />
              <span className="text-foreground/40">Automation.</span>
              <br />
              <span className="text-foreground">Security.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 animate-fade-in-up font-sans" style={{ animationDelay: "0.1s" }}>
              Digital saving hub, trusted online marketplace, intelligent wealth automation and a safe lending ecosystem - where investment align with security, powered by rewarding referral opportunities.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Link to="/marketplace">
                <Button size="lg" className="gap-2 px-10 py-4 text-base bg-gold-gradient hover:opacity-90 text-primary-foreground font-semibold shadow-xl whitespace-pre-line" style={{ boxShadow: '0 8px 30px hsl(43 65% 55% / 0.35)' }}>
                  {t('landing.instantProcessing')} <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-10 py-4 text-base border-gold/30 text-foreground hover:border-gold/60 hover:bg-gold/5"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                Learn More
              </Button>
            </div>

            {/* Features highlight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-16 mt-20 pt-16 border-t border-border/50 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              {[
                { value: "50/50", label: "Split Strategy" },
                { value: "5", label: "Referral Levels" },
                { value: "6", label: "Investment Tiers" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-5xl font-bold font-mono text-gradient-gold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-2">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-24 px-4 sm:px-6 border-t border-border/30 relative z-10 bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-display">
              Save Smart. Invest Secure. Trade Safely
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: TrendingUp,
                title: "Smart Investing",
                description: "Your capital is split 50/50 between investment and MLM pools for balanced growth."
              },
              {
                icon: Users,
                title: "Referral Network",
                description: "Build your team across 5 levels and earn commissions on their investments."
              },
              {
                icon: Shield,
                title: "Blogs",
                description: "Explore the latest marketplace insights, tutorials, and success stories."
              },
              {
                icon: Zap,
                title: "Discover a secure and trusted marketplace for<br />Real Estate, Automobiles & Electronics",
                description: "Browse verified listings and connect with trusted sellers.",
                useHtml: true
              },
              {
                icon: Lock,
                title: "Secure Loans & Assets",
                description: "Unlock secure loans and asset-backed products with trusted collateral."
              },
              {
                icon: BarChart3,
                title: "Live Analytics",
                description: "Track your earnings, team growth, and portfolio performance in real-time."
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-lg border border-border bg-card/50 card-gold-hover"
              >
                <div className="w-11 h-11 rounded-lg bg-gold/10 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-sans">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Tiers Preview */}
      <section className="py-24 px-6 border-t border-border/30 bg-background/95 backdrop-blur-sm relative z-10">
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-display">
              Investment <span className="text-gradient-gold">Tiers</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto font-sans">
              Choose your entry point. Every tier unlocks the full potential of our platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "Starter", amount: 50, glow: 0.05 },
              { name: "Golden", amount: 100, glow: 0.1 },
              { name: "Premium", amount: 500, glow: 0.15 },
              { name: "Business", amount: 1000, glow: 0.2 },
              { name: "Platinum", amount: 2500, glow: 0.25 },
              { name: "Achiever", amount: 5000, glow: 0.35 },
            ].map((tier) => (
              <div
                key={tier.name}
                className="p-5 rounded-lg border border-border bg-card/50 hover:border-gold/40 transition-all duration-500 text-center group cursor-pointer"
                style={{ 
                  ['--tier-glow' as string]: tier.glow,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px hsl(43 65% 55% / ${tier.glow})`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-sans">
                  {tier.name}
                </div>
                <div className="text-2xl font-bold font-mono group-hover:text-accent transition-colors">
                  ${tier.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gap-2 bg-gold-gradient hover:opacity-90 text-primary-foreground font-semibold shadow-xl" style={{ boxShadow: '0 8px 30px hsl(43 65% 55% / 0.3)' }}>
                Start Investing <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/30 relative z-10 bg-background">
        <div className="container mx-auto max-w-6xl relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Golden Wealth Achievers logo" className="w-20 h-20 rounded-lg shadow-lg bg-transparent" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))' }} />
                <span className="text-sm text-muted-foreground font-sans">© {new Date().getFullYear()} Golden Wealth Achievers. All rights reserved.</span>
              </div>
              <div className="text-sm text-muted-foreground font-sans">Powered by Bisolkay Int'l Company, duly registered in Nigeria.</div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground font-sans">
              <Link to="/terms" className="hover:text-accent transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
              <Link to="/support" className="hover:text-accent transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;