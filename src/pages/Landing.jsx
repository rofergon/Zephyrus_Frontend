import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BeakerIcon, 
  ChatBubbleBottomCenterTextIcon,
  CubeTransparentIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  UserGroupIcon,
  SparklesIcon,
  CommandLineIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  CodeBracketIcon,
  LightBulbIcon,
  HomeIcon,
  WalletIcon
} from '@heroicons/react/24/outline';
import { useAccount } from 'wagmi';

// Efecto de matriz digital
const MatrixRain = () => {
  return (
    <div className="absolute inset-0 opacity-10 pointer-events-none">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-0 text-green-500 text-xs font-mono"
          style={{ left: `${i * 10}%` }}
          initial={{ y: -100 }}
          animate={{ 
            y: ['0%', '100%'],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          {[...Array(20)].map((_, j) => (
            <div key={j} className="my-1">
              {Math.random().toString(36).charAt(2)}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
};

// Efecto de red neuronal
const NeuralNetwork = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 bg-blue-400/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <motion.div
            className="absolute w-20 h-0.5 bg-gradient-to-r from-blue-400/20 to-transparent origin-left"
            style={{
              rotate: `${Math.random() * 360}deg`
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

const features = [
  {
    icon: CommandLineIcon,
    title: "AI-Powered Contract Generation",
    description: "Let our advanced AI agents create and optimize smart contracts based on your requirements.",
    color: "blue"
  },
  {
    icon: ChatBubbleBottomCenterTextIcon,
    title: "Intelligent Assistant",
    description: "Real-time guidance and code suggestions from our AI that understands Solidity best practices.",
    color: "purple"
  },
  {
    icon: CircleStackIcon,
    title: "Smart Template System",
    description: "AI-curated templates that adapt to your needs and learn from the community.",
    color: "green"
  },
  {
    icon: CloudArrowUpIcon,
    title: "Automated Deployment",
    description: "AI-optimized deployment process with automatic gas optimization and security checks.",
    color: "orange"
  },
  {
    icon: CodeBracketIcon,
    title: "Intelligent Validation",
    description: "Real-time code analysis and bug detection powered by machine learning.",
    color: "pink"
  },
  {
    icon: LightBulbIcon,
    title: "Learning Network",
    description: "Community-driven platform that evolves with each interaction and contribution.",
    color: "yellow"
  }
];

const Landing = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.98]);
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const scaleSpring = useSpring(scale, springConfig);
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  // Texto que simula la IA escribiendo
  const [displayText, setDisplayText] = useState('');
  const fullText = 'Build Smart Contracts with AI Agents';
  
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.substring(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Efecto para redirigir al usuario al chat cuando conecta su billetera
  useEffect(() => {
    if (isConnected) {
      navigate('/chat');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      <MatrixRain />
      <NeuralNetwork />

      {/* Hero Section */}
      <motion.div 
        className="container mx-auto px-4 pt-12 pb-32 relative"
        style={{ y, opacity, scale: scaleSpring }}
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 relative"
          >
            <div className="flex items-center justify-center mb-4">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-16 h-16 rounded-full bg-blue-500/20 p-3"
              >
                <CpuChipIcon className="w-full h-full text-blue-400" />
              </motion.div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              {displayText}
              <motion.span
                animate={{ opacity: [0, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                |
              </motion.span>
            </h1>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-300 mb-8"
          >
            Experience the future of smart contract development with our AI agents.
            Let them handle the complexity while you focus on innovation.
          </motion.p>
          <motion.div 
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Botones de acción */}
            <div className="flex flex-col items-center gap-4">
              {isConnected ? (
                <div className="flex gap-4">
                  <Link 
                    to="/dashboard" 
                    className="group relative px-8 py-3 bg-blue-600 text-white rounded-lg overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600"
                      animate={{
                        x: ["0%", "100%"],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                    <span className="relative flex items-center gap-2">
                      <HomeIcon className="w-5 h-5" />
                      Go to Dashboard
                    </span>
                  </Link>
                  <Link 
                    to="/chat" 
                    className="group px-8 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all duration-300 relative overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700"
                      initial={{ x: "100%" }}
                      whileHover={{ x: "0%" }}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="relative flex items-center gap-2">
                      <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                      Chat with AI
                    </span>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="glass-morphism p-6 rounded-lg text-center mb-4 relative overflow-hidden group">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                    <h3 className="text-lg font-semibold text-gray-200 mb-4">
                      Connect your wallet to start building
                    </h3>
                    <div className="relative">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="group relative inline-block"
                      >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-200"></div>
                        <button className="relative px-8 py-3 bg-gray-900 rounded-lg leading-none flex items-center gap-2 text-gray-200">
                          <WalletIcon className="w-5 h-5" />
                          <appkit-button />
                        </button>
                      </motion.div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Link 
                      to="/templates" 
                      className="group relative px-8 py-3 bg-gray-700 text-gray-200 rounded-lg overflow-hidden"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700"
                        initial={{ x: "100%" }}
                        whileHover={{ x: "0%" }}
                        transition={{ duration: 0.3 }}
                      />
                      <span className="relative flex items-center gap-2">
                        <CodeBracketIcon className="w-5 h-5" />
                        View Templates
                      </span>
                    </Link>
                    <Link 
                      to="/chat" 
                      className="group px-8 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all duration-300 relative overflow-hidden"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700"
                        initial={{ x: "100%" }}
                        whileHover={{ x: "0%" }}
                        transition={{ duration: 0.3 }}
                      />
                      <span className="relative flex items-center gap-2">
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                        Try AI Chat
                      </span>
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Redes soportadas */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-4 text-sm text-gray-400"
            >
              <span>Supported Networks:</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Sonic Blaze Testnet</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Features Grid with Hexagonal Layout */}
      <div className="bg-gray-900/50 py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, rotateY: 10 }}
                className="glass-morphism p-6 rounded-lg relative overflow-hidden group transform perspective-1000"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className={`w-12 h-12 rounded-lg bg-${feature.color}-500/20 p-2 mb-4`}
                  >
                    <feature.icon className={`w-full h-full text-${feature.color}-400`} />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">
                    {feature.description}
                  </p>
                </div>
                <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* How It Works - Timeline Style */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            AI-Powered Workflow
          </h2>
          <div className="space-y-12 relative">
            <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />
            {[
              { 
                number: "01", 
                title: "Describe Your Needs", 
                desc: "Tell our AI agents what you want to build in plain language", 
                color: "blue",
                icon: ChatBubbleBottomCenterTextIcon
              },
              { 
                number: "02", 
                title: "AI Generation", 
                desc: "Watch as our AI creates and optimizes your smart contract", 
                color: "purple",
                icon: CpuChipIcon
              },
              { 
                number: "03", 
                title: "Review & Deploy", 
                desc: "Verify the contract and deploy with one click", 
                color: "pink",
                icon: RocketLaunchIcon
              }
            ].map((step, index) => (
              <motion.div
                key={step.number}
                className="flex items-start relative"
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <motion.div
                  whileHover={{ scale: 1.2 }}
                  className={`w-11 h-11 rounded-full bg-${step.color}-500/20 flex items-center justify-center relative z-10`}
                >
                  <step.icon className={`w-6 h-6 text-${step.color}-400`} />
                </motion.div>
                <div className="ml-8">
                  <div className={`text-sm font-mono text-${step.color}-400 mb-1`}>
                    Step {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-400">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="glass-morphism max-w-4xl mx-auto p-12 rounded-lg text-center relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20"
            animate={{
              x: ["0%", "100%"],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Build the Future?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join the AI-powered revolution in Web3 development
            </p>
            <Link 
              to="/templates" 
              className="relative inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg group overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700"
                initial={{ x: "100%" }}
                whileHover={{ x: "0%" }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative group-hover:scale-105 transition-transform inline-block flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                Start Creating
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing; 