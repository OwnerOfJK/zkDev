import { useState } from "react";
import Image from "next/image";

interface ProfilePictureSelectorProps {
  onSelect: (avatarUrl: string) => void;
  currentAvatar?: string;
}



export const ProfilePictureSelector = ({ onSelect, currentAvatar }: ProfilePictureSelectorProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar || funAvatars[0]);

  const handleSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl);
    onSelect(avatarUrl);
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Choose Your Profile Picture</h3>
      <div className="grid grid-cols-4 gap-4">
        {funAvatars.map((avatar) => (
          <div
            key={avatar}
            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 ${
              selectedAvatar === avatar ? "border-primary" : "border-transparent"
            } hover:border-primary/50 transition-all`}
            onClick={() => handleSelect(avatar)}
          >
            <div className="aspect-square relative">
              <Image
                src={avatar}
                alt="Profile avatar option"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
