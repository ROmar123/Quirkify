import { motion } from 'motion/react';

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`flex items-center ${className}`}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <img
        src="/logo.png"
        alt="Quirkify"
        className="h-14 w-auto object-contain drop-shadow-sm"
      />
    </motion.div>
  );
}
