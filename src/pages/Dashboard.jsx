import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const stats = [
    { label: 'Contracts Deployed', value: '12', change: '+2 this week', color: 'blue' },
    { label: 'Templates Available', value: '25', change: '+5 new', color: 'green' },
    { label: 'Images Generated', value: '48', change: '+12 today', color: 'purple' },
    { label: 'Total Gas Saved', value: '2.5 ETH', change: '≈ $4,250', color: 'yellow' },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'deploy',
      title: 'ERC20 Token Deployed',
      time: '2 hours ago',
      address: '0x1234...5678',
      status: 'success',
    },
    {
      id: 2,
      type: 'image',
      title: 'Token Image Generated',
      time: '4 hours ago',
      status: 'success',
    },
    {
      id: 3,
      type: 'template',
      title: 'NFT Contract Created',
      time: '1 day ago',
      status: 'pending',
    },
  ];

  return (
    <div className="container mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-morphism gradient-border rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-sm font-medium">
                {stat.label}
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${stat.color}-500/10 text-${stat.color}-400`}>
                {stat.change}
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold text-white">
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-morphism gradient-border rounded-lg p-6"
        >
          <h2 className="text-xl font-bold mb-6 text-white">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { to: '/chat', title: 'Start AI Chat', desc: 'Get help with your smart contracts', gradient: 'from-blue-500 to-blue-600' },
              { to: '/templates', title: 'Browse Templates', desc: 'Start with pre-built contracts', gradient: 'from-green-500 to-green-600' },
              { to: '/image-generator', title: 'Generate Images', desc: 'Create token artwork', gradient: 'from-purple-500 to-purple-600' },
              { to: '/deploy', title: 'Deploy Contract', desc: 'Launch your smart contract', gradient: 'from-yellow-500 to-yellow-600' }
            ].map((action, index) => (
              <Link
                key={index}
                to={action.to}
                className={`glass-morphism gradient-border p-4 rounded-lg bg-gradient-to-br ${action.gradient} bg-opacity-10 hover:bg-opacity-20 transition-all duration-200 group`}
              >
                <h3 className="font-semibold text-white group-hover:scale-105 transition-transform">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-300">
                  {action.desc}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-morphism gradient-border rounded-lg p-6"
        >
          <h2 className="text-xl font-bold mb-6 text-white">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-morphism gradient-border p-4 rounded-lg hover:bg-gray-800/50 transition-all duration-200"
              >
                <div>
                  <h3 className="font-semibold text-white">
                    {activity.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {activity.time}
                  </p>
                  {activity.address && (
                    <p className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer">
                      {activity.address}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  activity.status === 'success'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {activity.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;