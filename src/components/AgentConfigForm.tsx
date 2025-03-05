import React, { useState, useEffect } from 'react';
import { DeployedContract } from '../types/contracts';

interface AgentConfigFormProps {
  contract: DeployedContract;
  onSave: (config: AgentConfig) => void;
  onCancel: () => void;
}

export interface AgentConfig {
  name: string;
  description: string;
  isActive: boolean;
  allowedFunctions: {
    functionId: string;
    functionName: string;
    type: 'read' | 'write';
    isAllowed: boolean;
    parameters?: {
      name: string;
      type: string;
      validation?: {
        min?: string | number;
        max?: string | number;
        pattern?: string;
      };
    }[];
  }[];
  gasLimitConfig: {
    customGasLimit: boolean;
    gasLimit: string;
    maxPriorityFeePerGas: string;
  };
  scheduleConfig: {
    isScheduled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'custom';
    customCron?: string;
  };
  notifications: {
    email: boolean;
    discord: boolean;
    telegram: boolean;
    emailAddress?: string;
    discordWebhook?: string;
    telegramChatId?: string;
  };
}

const defaultConfig: AgentConfig = {
  name: '',
  description: '',
  isActive: false,
  allowedFunctions: [],
  gasLimitConfig: {
    customGasLimit: false,
    gasLimit: '300000',
    maxPriorityFeePerGas: '1.5',
  },
  scheduleConfig: {
    isScheduled: false,
    frequency: 'daily',
    customCron: '',
  },
  notifications: {
    email: false,
    discord: false,
    telegram: false,
    emailAddress: '',
    discordWebhook: '',
    telegramChatId: '',
  },
};

const AgentConfigForm: React.FC<AgentConfigFormProps> = ({ contract, onSave, onCancel }) => {
  const [config, setConfig] = useState<AgentConfig>({
    ...defaultConfig,
    name: `${contract.name} Agent`,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'read' | 'write' | 'all'>('all');

  // Procesar el ABI para extraer las funciones
  useEffect(() => {
    if (contract && contract.abi) {
      const functions = contract.abi
        .filter((item: any) => item.type === 'function')
        .map((func: any) => ({
          functionId: `${func.name}_${func.inputs.map((i: any) => i.type).join('_')}`,
          functionName: func.name,
          type: (func.stateMutability === 'view' || func.stateMutability === 'pure') ? 'read' as const : 'write' as const,
          isAllowed: false,
          parameters: func.inputs.map((input: any) => ({
            name: input.name,
            type: input.type,
            validation: {},
          })),
        }));

      setConfig(prev => ({
        ...prev,
        allowedFunctions: functions,
      }));
    }
  }, [contract]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleFunctionToggle = (functionId: string) => {
    setConfig(prev => ({
      ...prev,
      allowedFunctions: prev.allowedFunctions.map(func => 
        func.functionId === functionId ? { ...func, isAllowed: !func.isAllowed } : func
      ),
    }));
  };

  const handleGasConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      gasLimitConfig: {
        ...prev.gasLimitConfig,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleScheduleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setConfig(prev => ({
      ...prev,
      scheduleConfig: {
        ...prev.scheduleConfig,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const filteredFunctions = config.allowedFunctions.filter(func => 
    selectedTab === 'all' || func.type === selectedTab
  );

  // Renderiza el paso actual del formulario
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-blue-300 mb-6">Agent Basic Configuration</h3>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">Agent Name</label>
              <input
                type="text"
                name="name"
                value={config.name}
                onChange={handleInputChange}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter agent name"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">Description</label>
              <textarea
                name="description"
                value={config.description}
                onChange={handleInputChange}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[120px] resize-none"
                placeholder="Describe what this agent will do"
              />
            </div>
            
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={config.isActive}
                onChange={handleCheckboxChange}
                className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-400">
                Activate agent immediately after creation
              </label>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Select Allowed Functions</h3>
            
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={() => setSelectedTab('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedTab === 'all' 
                    ? 'bg-gray-700 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                All Functions
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('read')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedTab === 'read' 
                    ? 'bg-emerald-900/70 text-emerald-300' 
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Read Functions
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('write')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedTab === 'write' 
                    ? 'bg-blue-900/70 text-blue-300' 
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Write Functions
              </button>
            </div>
            
            <div className="bg-gray-900/30 rounded-lg p-4 max-h-96 overflow-y-auto">
              {filteredFunctions.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No functions found in this category</p>
              ) : (
                <div className="space-y-3">
                  {filteredFunctions.map((func) => (
                    <div 
                      key={func.functionId} 
                      className={`p-3 border rounded-lg transition-colors ${
                        func.isAllowed 
                          ? func.type === 'read'
                            ? 'border-emerald-500/50 bg-emerald-900/20'
                            : 'border-blue-500/50 bg-blue-900/20'
                          : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={func.functionId}
                            checked={func.isAllowed}
                            onChange={() => handleFunctionToggle(func.functionId)}
                            className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={func.functionId} className="text-sm font-medium text-gray-300 flex items-center">
                            {func.functionName}
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              func.type === 'read' 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {func.type}
                            </span>
                          </label>
                        </div>
                        
                        {func.isAllowed && func.parameters && func.parameters.length > 0 && (
                          <div className="text-xs text-gray-400">
                            {func.parameters.length} {func.parameters.length === 1 ? 'parameter' : 'parameters'}
                          </div>
                        )}
                      </div>
                      
                      {func.isAllowed && func.parameters && func.parameters.length > 0 && (
                        <div className="mt-3 space-y-2 pl-6">
                          <p className="text-xs text-gray-400 mb-2">Parameter Validation Rules:</p>
                          
                          {func.parameters.map((param, index) => (
                            <div key={index} className="pl-2 border-l border-gray-700 py-1">
                              <div className="flex items-center mb-1">
                                <span className="text-xs font-medium text-gray-300">{param.name}</span>
                                <span className="ml-1 text-xs text-gray-500">({param.type})</span>
                              </div>
                              
                              {/* Aquí podrían agregarse campos para configurar validaciones de parámetros */}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Gas & Execution Settings</h3>
            
            <div className="glass-morphism p-4 rounded-lg border border-gray-700">
              <h4 className="text-md font-medium text-gray-300 mb-3">Gas Settings</h4>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="customGasLimit"
                  name="customGasLimit"
                  checked={config.gasLimitConfig.customGasLimit}
                  onChange={handleGasConfigChange}
                  className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                />
                <label htmlFor="customGasLimit" className="ml-2 block text-sm text-gray-400">
                  Use custom gas settings
                </label>
              </div>
              
              {config.gasLimitConfig.customGasLimit && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Gas Limit</label>
                    <input
                      type="text"
                      name="gasLimit"
                      value={config.gasLimitConfig.gasLimit}
                      onChange={handleGasConfigChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Max Priority Fee (GWEI)</label>
                    <input
                      type="text"
                      name="maxPriorityFeePerGas"
                      value={config.gasLimitConfig.maxPriorityFeePerGas}
                      onChange={handleGasConfigChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="glass-morphism p-4 rounded-lg border border-gray-700 mt-4">
              <h4 className="text-md font-medium text-gray-300 mb-3">Execution Schedule</h4>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="isScheduled"
                  name="isScheduled"
                  checked={config.scheduleConfig.isScheduled}
                  onChange={handleScheduleConfigChange}
                  className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                />
                <label htmlFor="isScheduled" className="ml-2 block text-sm text-gray-400">
                  Schedule automatic execution
                </label>
              </div>
              
              {config.scheduleConfig.isScheduled && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Frequency</label>
                    <select
                      name="frequency"
                      value={config.scheduleConfig.frequency}
                      onChange={handleScheduleConfigChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  
                  {config.scheduleConfig.frequency === 'custom' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-400">Custom Cron Expression</label>
                      <input
                        type="text"
                        name="customCron"
                        value={config.scheduleConfig.customCron || ''}
                        onChange={handleScheduleConfigChange}
                        placeholder="*/10 * * * *"
                        className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">e.g. "*/10 * * * *" runs every 10 minutes</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Notifications</h3>
            
            <div className="glass-morphism p-4 rounded-lg border border-gray-700">
              <h4 className="text-md font-medium text-gray-300 mb-3">Notification Channels</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="emailNotif"
                      name="email"
                      checked={config.notifications.email}
                      onChange={handleNotificationChange}
                      className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="emailNotif" className="ml-2 block text-sm text-gray-400">
                      Email Notifications
                    </label>
                  </div>
                </div>
                
                {config.notifications.email && (
                  <div className="ml-6 space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Email Address</label>
                    <input
                      type="email"
                      name="emailAddress"
                      value={config.notifications.emailAddress || ''}
                      onChange={handleNotificationChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="your@email.com"
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="discordNotif"
                      name="discord"
                      checked={config.notifications.discord}
                      onChange={handleNotificationChange}
                      className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="discordNotif" className="ml-2 block text-sm text-gray-400">
                      Discord Notifications
                    </label>
                  </div>
                </div>
                
                {config.notifications.discord && (
                  <div className="ml-6 space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Discord Webhook URL</label>
                    <input
                      type="text"
                      name="discordWebhook"
                      value={config.notifications.discordWebhook || ''}
                      onChange={handleNotificationChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="https://discord.com/api/webhooks/..."
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="telegramNotif"
                      name="telegram"
                      checked={config.notifications.telegram}
                      onChange={handleNotificationChange}
                      className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="telegramNotif" className="ml-2 block text-sm text-gray-400">
                      Telegram Notifications
                    </label>
                  </div>
                </div>
                
                {config.notifications.telegram && (
                  <div className="ml-6 space-y-1">
                    <label className="block text-xs font-medium text-gray-400">Telegram Chat ID</label>
                    <input
                      type="text"
                      name="telegramChatId"
                      value={config.notifications.telegramChatId || ''}
                      onChange={handleNotificationChange}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Your Telegram Chat ID"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="glass-morphism p-4 rounded-lg border border-gray-700 mt-4">
              <h4 className="text-md font-medium text-gray-300 mb-3">Summary</h4>
              
              <div className="space-y-2 text-sm text-gray-400">
                <p>
                  <span className="font-medium">Agent Name:</span> {config.name}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {config.isActive ? 'Active' : 'Inactive'}
                </p>
                <p>
                  <span className="font-medium">Functions Enabled:</span> {config.allowedFunctions.filter(f => f.isAllowed).length} of {config.allowedFunctions.length}
                </p>
                <p>
                  <span className="font-medium">Scheduled Execution:</span> {config.scheduleConfig.isScheduled ? `Yes (${config.scheduleConfig.frequency})` : 'No'}
                </p>
                <p>
                  <span className="font-medium">Notifications:</span> {[
                    config.notifications.email && 'Email',
                    config.notifications.discord && 'Discord',
                    config.notifications.telegram && 'Telegram'
                  ].filter(Boolean).join(', ') || 'None'}
                </p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full glass-morphism gradient-border rounded-lg bg-gray-900/90 backdrop-blur-sm p-3 lg:p-4 border-gray-700/60 overflow-hidden flex flex-col">
      {/* Form Header */}
      <div className="border-b border-gray-700/50 pb-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <svg 
            className="h-5 w-5 text-indigo-400" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M10.5 22H5C3.34 22 2 20.66 2 19V18C2 17.45 2.45 17 3 17H13C13.55 17 14 17.45 14 18V19C14 20.66 12.66 22 11 22H10.5Z" fill="currentColor"/>
            <path d="M8 12C5.24 12 3 9.76 3 7V5C3 2.24 5.24 0 8 0C10.76 0 13 2.24 13 5V7C13 9.76 10.76 12 8 12Z" fill="currentColor"/>
            <path d="M19.8101 15.5698C20.1001 15.5698 20.3601 15.3998 20.4801 15.1298C20.6301 14.7798 20.4201 14.3998 20.0701 14.2498L16.0701 12.6698C15.9901 12.6398 15.9001 12.6198 15.8101 12.6198C15.4901 12.6198 15.1801 12.8298 15.0901 13.1598C15.0401 13.3198 15.0501 13.4798 15.1001 13.6198L16.8001 17.7798C16.9501 18.1298 17.3301 18.3398 17.6801 18.1898C18.0301 18.0398 18.2401 17.6598 18.0901 17.3098L17.7701 16.5698H20.3101C20.5401 16.5698 20.7601 16.6498 20.9201 16.8098C21.2901 17.1798 21.2901 17.7898 20.9201 18.1598L19.1001 19.9798C18.7301 20.3498 18.1201 20.3498 17.7501 19.9798C17.3801 19.6098 17.3801 18.9998 17.7501 18.6298L17.9201 18.4598C18.1301 18.2498 18.1301 17.9098 17.9201 17.6998C17.7101 17.4898 17.3701 17.4898 17.1601 17.6998L17.0001 17.8698C16.2201 18.6498 16.2201 19.9598 17.0001 20.7398C17.7801 21.5198 19.0901 21.5198 19.8701 20.7398L21.6901 18.9198C22.4701 18.1398 22.4701 16.8298 21.6901 16.0498C21.3001 15.6698 20.7801 15.4698 20.2601 15.4698H19.8001L19.8101 15.5698Z" fill="currentColor"/>
          </svg>
          Agent Configuration
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Configure an automated agent to interact with your contract
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex mb-4 relative border-b border-gray-700/30 pb-3">
        <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500" style={{ width: `${(currentStep / 3) * 100}%`, transition: 'width 0.3s ease-in-out' }}></div>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 flex flex-col items-center relative z-10 cursor-pointer ${currentStep >= s ? 'text-indigo-400' : 'text-gray-400'}`}
            onClick={() => {
              if (currentStep > s) setCurrentStep(s);
            }}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 ${
              currentStep > s 
                ? 'bg-indigo-500 text-white' 
                : currentStep === s 
                  ? 'bg-indigo-500/20 border border-indigo-500 text-indigo-400' 
                  : 'bg-gray-800 border border-gray-700 text-gray-500'
            }`}>
              {s}
            </div>
            <span className="text-xs">
              {s === 1 ? 'Select Functions' : s === 2 ? 'Configure Logic' : 'Review'}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-auto custom-scrollbar flex-1 px-1">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-4 flex justify-between pt-3 border-t border-gray-700/30">
        {currentStep > 1 ? (
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg 
              className="w-4 h-4" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15 19.9201L8.47997 13.4001C7.70997 12.6301 7.70997 11.3701 8.47997 10.6001L15 4.08008" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        ) : (
          <div></div>
        )}

        {currentStep < 3 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            Next
            <svg 
              className="w-4 h-4" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8.91003 19.9201L15.43 13.4001C16.2 12.6301 16.2 11.3701 15.43 10.6001L8.91003 4.08008" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10.5 16.0858V14.5C17.5 14.5 19 17.5 19 17.5C19 11 15.5 8 10.5 8V6.41425C10.5 5.52375 9.393 5.07725 8.757 5.71325L4.828 9.64225C4.438 10.0323 4.438 10.6657 4.828 11.0558L8.757 14.9868C9.393 15.6218 10.5 15.1763 10.5 14.2858V16.0858Z" fill="currentColor"/>
            </svg>
            Create Agent
          </button>
        )}
      </div>

      {/* Replace style jsx with regular style tag */}
      <style>
        {`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.4);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.6);
        }
        `}
      </style>
    </div>
  );
};

export default AgentConfigForm; 