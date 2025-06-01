'use client';

import { useState } from 'react';
import { User, Lock, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConnectGitHubAccount } from '~~/components/ConnectGitHubAccount';

interface ProfileData {
  name: string;
  description: string;
}

interface ConnectedAccount {
  id: string;
  username: string;
  avatar_url: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    description: ''
  });
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAccountConnected = (account: ConnectedAccount) => {
    setConnectedAccounts([...connectedAccounts, account]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real app, this would save to a database
    console.log('Profile data:', profileData);
    
    setIsSaving(false);
    setSaveSuccess(true);

  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-base-200 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-4 mb-8">
          <User className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Public Profile</h1>
        </div>

        <div className="bg-base-300 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-primary mt-1" />
            <div>
              <h2 className="text-lg font-semibold mb-2">Your Privacy is Protected</h2>
              <p className="text-base-content/80">
                This is your public profile that others can see. Your GitHub activity, commits, and other sensitive data remain private and are only used to generate your proofs.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text text-lg">Display Name</span>
            </label>
            <input
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your display name"
              className="input input-bordered w-full"
              maxLength={50}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-lg">About Me</span>
            </label>
            <textarea
              value={profileData.description}
              onChange={(e) => setProfileData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Tell others about yourself"
              className="textarea textarea-bordered w-full h-32 pl-10 pr-10"
              maxLength={500}
            />
            <label className="label">
              <span className="label-text-alt">{profileData.description.length}/500 characters</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              className={`btn btn-primary min-w-[120px] ${isSaving ? 'loading' : ''}`}
              disabled={isSaving || saveSuccess}
            >
              {saveSuccess ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Saved!</span>
                </div>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
          <div className="bg-base-200 p-6 rounded-lg shadow-lg">
            <ConnectGitHubAccount
              connectedAccounts={connectedAccounts}
              onAccountConnected={handleAccountConnected}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
