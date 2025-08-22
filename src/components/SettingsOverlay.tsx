import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
  const { profile, updateProfile, languagePreference } = useProfile();
  const { toast } = useToast();
  const [tab, setTab] = useState<'profile'|'language'|'password'|'upgrade'|'delete'>('profile');
  const [name, setName] = useState(profile?.name || '');
  const [lang, setLang] = useState(languagePreference || 'en');
  const [newPassword, setNewPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const saveProfile = async () => {
    const { error } = await updateProfile({ name });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved', description: 'Profile updated' });
  };

  const saveLanguage = async () => {
    const { error } = await updateProfile({ language_preference: lang });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved', description: 'Language preference updated' });
  };

  const changePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Password updated', description: 'Your password has been changed.' });
  };

  const deleteAccount = async () => {
    if (!confirm('Are you sure? This will permanently delete your account and all your courses. This action cannot be undone.')) return;
    
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
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: 'Account deleted', description: 'Your account has been permanently deleted.' });
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        toast({ title: 'Error', description: data?.error || 'Failed to delete account', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Settings</CardTitle>
          <div className="flex gap-2 text-sm">
            <Button variant={tab==='profile'? 'default':'outline'} onClick={() => setTab('profile')}>Profile</Button>
            <Button variant={tab==='language'? 'default':'outline'} onClick={() => setTab('language')}>Language</Button>
            <Button variant={tab==='password'? 'default':'outline'} onClick={() => setTab('password')}>Change Password</Button>
            <Button variant={tab==='upgrade'? 'default':'outline'} onClick={() => setTab('upgrade')}>Upgrade Plan</Button>
            <Button variant={tab==='delete'? 'default':'outline'} onClick={() => setTab('delete')}>Delete Account</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tab === 'profile' && (
            <div className="space-y-3">
              <label className="text-sm">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveProfile}>Save</Button>
            </div>
          )}
          {tab === 'language' && (
            <div className="space-y-3">
              <label className="text-sm">Preferred Language</label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="pcm">Pidgin</SelectItem>
                  <SelectItem value="ig">Igbo</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={saveLanguage}>Save</Button>
            </div>
          )}
          {tab === 'password' && (
            <div className="space-y-3">
              <label className="text-sm">New Password</label>
              <Input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
              <Button onClick={changePassword}>Update Password</Button>
            </div>
          )}
          {tab === 'upgrade' && (
            <div className="text-sm text-muted-foreground">Upgrade options coming soon.</div>
          )}
          {tab === 'delete' && (
            <div className="space-y-3">
              <div className="text-sm text-destructive">This action is irreversible and will permanently delete your account and all associated data.</div>
              <Button variant="destructive" onClick={deleteAccount} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          )}
          <div className="pt-4">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


