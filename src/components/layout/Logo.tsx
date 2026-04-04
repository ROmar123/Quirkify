import { motion } from 'motion/react';

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`flex items-center overflow-hidden ${className}`}
      style={{ width: 120, height: 40 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <img
        src="/logo.png"
        alt="Quirkify"
        style={{
          width: 172,
          height: 'auto',
          marginLeft: -20,
          marginTop: 6,
        }}
        className="object-contain"
      />
    </motion.div>
  );
}
