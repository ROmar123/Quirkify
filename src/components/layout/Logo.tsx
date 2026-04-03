import { motion } from 'motion/react';

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div 
        whileHover={{ scale: 1.05, rotate: 5 }}
        className="w-10 h-10 bg-black rounded-none flex items-center justify-center text-white font-display relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-quirky translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative z-10 text-xl font-bold tracking-tighter">Q</span>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyber rotate-45" />
      </motion.div>
      <div className="flex flex-col leading-none">
        <span className="font-display font-black tracking-widest text-lg">QUIRKIFY</span>
        <span className="text-[6px] font-bold tracking-[0.4em] text-zinc-400 uppercase">Aura Ecosystem</span>
      </div>
    </div>
  );
}
