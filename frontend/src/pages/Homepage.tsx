import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function Homepage() {
  const navigate = useNavigate();
  
  // This is a public page, not noindex
  useDocumentTitle("/", { 
    title: "AzerothFlipLocal - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft. Monitor realm markets, track price trends, and optimize your gold strategies with real-time auction house data.",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-ember">AzerothFlipLocal</div>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-lg bg-ember text-white font-medium hover:bg-ember/80 transition"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
          Master the WoW <span className="text-ember">Gold Market</span>
        </h1>
        <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          Real-time auction house analysis, market trend tracking, and profit opportunity discovery for World of Warcraft gold flipping.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => navigate("/login")}
            className="px-8 py-3 rounded-full bg-ember text-white font-semibold hover:bg-ember/80 transition"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate("/public/docs")}
            className="px-8 py-3 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition"
          >
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-3 gap-8">
        <div className="border border-white/10 rounded-xl p-6 bg-white/5 hover:bg-white/10 transition">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-xl font-semibold mb-2">Real-Time Analytics</h3>
          <p className="text-slate-300">
            Monitor auction house prices across realms with live market data updates and trend analysis.
          </p>
        </div>
        <div className="border border-white/10 rounded-xl p-6 bg-white/5 hover:bg-white/10 transition">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-xl font-semibold mb-2">Smart Filtering</h3>
          <p className="text-slate-300">
            Find profitable flips using customizable presets and advanced market analysis tools.
          </p>
        </div>
        <div className="border border-white/10 rounded-xl p-6 bg-white/5 hover:bg-white/10 transition">
          <div className="text-3xl mb-3">🚀</div>
          <h3 className="text-xl font-semibold mb-2">Realm Discovery</h3>
          <p className="text-slate-300">
            Discover high-opportunity realms based on market volatility and profit margins.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
        <div className="space-y-6">
          <div className="flex gap-6 items-start">
            <div className="flex-none w-12 h-12 rounded-full bg-ember/20 text-ember flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Create Account & Link Realms</h3>
              <p className="text-slate-300">Sign up and configure the WoW realms you want to monitor for gold-making opportunities.</p>
            </div>
          </div>
          <div className="flex gap-6 items-start">
            <div className="flex-none w-12 h-12 rounded-full bg-ember/20 text-ember flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Set Profit Targets</h3>
              <p className="text-slate-300">Define your profit margins, price thresholds, and item preferences using smart filters.</p>
            </div>
          </div>
          <div className="flex gap-6 items-start">
            <div className="flex-none w-12 h-12 rounded-full bg-ember/20 text-ember flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Find Opportunities</h3>
              <p className="text-slate-300">The scanner continuously analyzes auction house data and surfaces profitable flips matching your criteria.</p>
            </div>
          </div>
          <div className="flex gap-6 items-start">
            <div className="flex-none w-12 h-12 rounded-full bg-ember/20 text-ember flex items-center justify-center font-bold">4</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Execute & Profit</h3>
              <p className="text-slate-300">List the items in WoW's auction house and capture the profit when they sell.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Start Optimizing Your Gold Strategies Today</h2>
        <p className="text-slate-300 mb-8">Free account. No credit card required.</p>
        <button
          onClick={() => navigate("/login")}
          className="px-8 py-3 rounded-full bg-ember text-white font-semibold hover:bg-ember/80 transition"
        >
          Create Account
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/50 backdrop-blur-md py-8 text-slate-400 text-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p>&copy; 2026 AzerothFlipLocal. World of Warcraft is a trademark of Blizzard Entertainment.</p>
            <button
              onClick={() => navigate("/public/docs")}
              className="text-slate-300 hover:text-white transition"
            >
              Documentation
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
