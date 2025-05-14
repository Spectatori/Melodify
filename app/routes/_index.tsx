import type { MetaFunction } from "@remix-run/node";
import Background from "/IndexPage/background.jpg";
import { useNavigate } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [{ title: "Melodify" }];
};

export default function Index() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400 flex-col">
      <div className="flex items-center pt-24 flex-col px-6">
        <h1 className="text-7xl md:text-8xl font-bold text-white drop-shadow-lg animate-slide-in">
          Welcome to Melodify
        </h1>
        <h2 className="pt-10 text-xl md:text-2xl text-white/90 text-center max-w-3xl leading-relaxed animate-slide-up">
          Melodify is a unique and robust web app that lets you choose your vibe and creates the perfect Spotify playlist for you.
        </h2>
      </div>
      
      <div className="flex items-center justify-center pt-16">
        <button 
          className="bg-white/20 backdrop-blur-md px-8 py-4 text-white rounded-lg text-xl
            ring-1 ring-white/30 shadow-xl hover:shadow-2xl hover:bg-white/30 
            transition-all duration-300 animate-slide-up"
          onClick={() => navigate("/login")}
        >
          Get Started
        </button>
      </div>
      
      <div className="flex justify-center pt-16 pb-20 px-4">
        <img 
          src={Background} 
          className="w-full max-w-3xl rounded-2xl shadow-2xl ring-1 ring-white/20 animate-slide-up"
          alt="Melodify Preview"
        />
      </div>
    </div>
  );
}