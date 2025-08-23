import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  language_preference?: string;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
        }
      } catch (error) {
        console.error('Profile fetch failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Helper function to get first name from full name
  const getFirstName = (fullName: string): string => {
    if (!fullName || typeof fullName !== 'string') return 'User';
    
    // Split by whitespace and get the first part
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    
    // Capitalize first letter and return
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  };

  // Get display name (first name) for UI
  const getDisplayName = (): string => {
    if (profile?.name) {
      return getFirstName(profile.name);
    }
    if (user?.email) {
      // Fallback to email username if no profile name
      const emailUsername = user.email.split('@')[0];
      return getFirstName(emailUsername);
    }
    return 'User';
  };

  return {
    profile,
    isLoading,
    userName: getDisplayName(),
    fullName: profile?.name || user?.email?.split('@')[0] || 'User',
    languagePreference: profile?.language_preference || 'en',
    async updateProfile(updates: { name?: string; language_preference?: string }) {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      if (!error && data) setProfile(data as any);
      return { data, error };
    }
  };
}