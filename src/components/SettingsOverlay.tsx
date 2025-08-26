import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X, User, Globe, Lock, Crown, Trash2, Loader2, Palette } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
  const { profile, updateProfile, languagePreference } = useProfile();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name || '');
  const [lang, setLang] = useState(languagePreference || 'en');
  const [newPassword, setNewPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const saveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name cannot be empty', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await updateProfile({ name: name.trim() });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Profile updated successfully' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveLanguage = async () => {
    setIsSaving(true);
    try {
      const { error } = await updateProfile({ language_preference: lang });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Language preference updated' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update language preference', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Password updated successfully' });
        setNewPassword('');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update password', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('Are you absolutely sure? This will permanently delete your account and all your courses. This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Error', description: 'User not found', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Delete account error:', error);
        toast({ title: 'Error', description: 'Failed to delete account. Please try again.', variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' });
        // Sign out and redirect to auth page
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        toast({ title: 'Error', description: data?.error || 'Failed to delete account', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Delete account exception:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred. Please try again.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-xl font-semibold">Settings</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/50">
              <TabsTrigger value="profile" className="flex items-center gap-2 text-xs md:text-sm">
                <User className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="language" className="flex items-center gap-2 text-xs md:text-sm">
                <Globe className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Language</span>
              </TabsTrigger>
              <TabsTrigger value="theme" className="flex items-center gap-2 text-xs md:text-sm">
                <Palette className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Theme</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2 text-xs md:text-sm">
                <Lock className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Password</span>
              </TabsTrigger>
              <TabsTrigger value="upgrade" className="flex items-center gap-2 text-xs md:text-sm">
                <Crown className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Upgrade</span>
              </TabsTrigger>
              <TabsTrigger value="delete" className="flex items-center gap-2 text-xs md:text-sm text-destructive">
                <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Delete</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <TabsContent value="profile" className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will be displayed throughout the app
                  </p>
                  <Button onClick={saveProfile} disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Profile
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="language" className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Preferred Language</label>
                  <Select value={lang} onValueChange={setLang}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="pcm">Pidgin</SelectItem>
                      <SelectItem value="ig">Igbo</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will be used for course generation and AI interactions
                  </p>
                  <Button onClick={saveLanguage} disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Language
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="theme" className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Theme Preference</label>
                  <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <div className="text-xs text-muted-foreground">
                      Choose between light, dark, or system theme
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="password" className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">New Password</label>
                  <Input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                  <Button onClick={changePassword} disabled={isSaving || !newPassword.trim()} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Update Password
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="upgrade" className="space-y-4">
                <div className="text-center py-8">
                  <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Upgrade Your Plan</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlock premium features and unlimited course generation
                  </p>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="delete" className="space-y-4">
                <div className="space-y-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold text-destructive">Delete Account</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-destructive/80">
                      This action is irreversible and will permanently delete:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-destructive/70">
                      <li>Your account and profile</li>
                      <li>All your courses and progress</li>
                      <li>All associated data</li>
                    </ul>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={deleteAccount} 
                    disabled={isDeleting}
                    className="w-full"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting Account...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account Permanently
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}


