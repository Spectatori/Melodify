import type { MetaFunction } from "@remix-run/node";
import Background from "../../public/IndexPage/background.jpg";

export const meta: MetaFunction = () => {
  return [
    { title: "Melodify" },
  ];
};

export default function Index() {
  return (
    <div className="flex w-screen h-screen bg-gradient-to-b from-secondary to-primary flex-col">
      <div className="flex w-screen items-center pt-14 flex-col">
        <h1 className="text-7xl text-primary">Welcome to Melodify</h1>
        <h2 className="pt-10 text-2xl text-primary">Melodify is a unique and robust web app that let’s you choose your vibe and creates the Spotify playlist for you.</h2>
      </div>
      <div className="flex w-screen items-center justify-center pt-20">
        <button className="bg-black p-5 text-primary rounded-sm text-xl">Get Started</button>
      </div>
      <div className="flex w-screen justify-center pt-16">
        <img src={Background} className="w-1/2"/>
      </div>

    </div>
  );
}
