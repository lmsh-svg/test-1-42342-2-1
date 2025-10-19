'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import Navbar from '@/components/marketplace/navbar';
import { Loader2, Save, Upload, Moon, Sun, Store, Percent, Users } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: number;
  username: string;
  role: string;
  storeName: string | null;
  storeLogo: string | null;
  storeMarkup: number;
  subUsersEnabled: boolean;
}

interface UserPreferences {
  theme: 'light' | 'dark';
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    storeName: '',
    storeLogo: '',
    storeMarkup: '0',
    subUsersEnabled: false,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchProfileAndPreferences();
    }
  }, [user, authLoading]);

  const fetchProfileAndPreferences = async () => {
    try {
      setIsLoading(true);
      
      // Fetch profile
      const profileRes = await fetch(`/api/user/profile?userId=${user?.id}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setFormData({
          storeName: profileData.storeName || '',
          storeLogo: profileData.storeLogo || '',
          storeMarkup: profileData.storeMarkup?.toString() || '0',
          subUsersEnabled: profileData.subUsersEnabled || false,
        });
      }
      
      // Fetch preferences
      const prefsRes = await fetch(`/api/user/preferences?userId=${user?.id}`);
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        setPreferences(prefsData);
        
        // Apply theme
        if (prefsData.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeToggle = async () => {
    if (!preferences) return;
    
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light';
    
    try {
      const res = await fetch(`/api/user/preferences?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setPreferences(updated);
        
        // Apply theme
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        toast.success(`Switched to ${newTheme} mode`);
      }
    } catch (error) {
      console.error('Failed to update theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      const res = await fetch(`/api/user/profile?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: formData.storeName || null,
          storeLogo: formData.storeLogo || null,
          storeMarkup: parseFloat(formData.storeMarkup),
          subUsersEnabled: formData.subUsersEnabled,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        
        toast.success('Your store settings have been updated');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your store preferences and account settings</p>
          </div>

          <div className="space-y-6">
            {/* Appearance Settings */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {preferences?.theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Appearance
                </CardTitle>
                <CardDescription>Customize how the site looks for you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Toggle between light and dark theme
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.theme === 'dark'}
                    onCheckedChange={handleThemeToggle}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Store Settings */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Store Settings
                </CardTitle>
                <CardDescription>Personalize your store identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    placeholder="Enter your store name"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will be displayed throughout your store
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeLogo">Store Logo URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="storeLogo"
                      placeholder="https://example.com/logo.png"
                      value={formData.storeLogo}
                      onChange={(e) => setFormData({ ...formData, storeLogo: e.target.value })}
                      className="bg-background/50"
                    />
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.storeLogo && (
                    <div className="mt-2">
                      <img
                        src={formData.storeLogo}
                        alt="Store logo preview"
                        className="h-16 w-16 object-contain border border-border rounded"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter a URL to an image for your store logo
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="storeMarkup" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Store Markup (%)
                  </Label>
                  <Input
                    id="storeMarkup"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                    value={formData.storeMarkup}
                    onChange={(e) => setFormData({ ...formData, storeMarkup: e.target.value })}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set the markup percentage for sub-user purchases (0-100%)
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Enable Sub-Users
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow creation of sub-users with markup pricing
                    </p>
                  </div>
                  <Switch
                    checked={formData.subUsersEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, subUsersEnabled: checked })}
                  />
                </div>

                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Account Information */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <p className="text-foreground font-medium">{profile?.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <p className="text-foreground font-medium capitalize">{profile?.role}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}