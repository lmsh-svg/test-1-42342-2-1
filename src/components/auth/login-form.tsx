'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, LogIn } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store auth token
        localStorage.setItem('auth_token', data.token);
        
        // Force redirect using window.location for better compatibility
        if (data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/marketplace';
        }
      } else {
        setError(data.error || 'Login failed');
        setIsLoading(false);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="Enter your username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
          autoComplete="username"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          autoComplete="current-password"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Shield className="h-4 w-4 mr-2 animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4 mr-2" />
            Login
          </>
        )}
      </Button>
    </form>
  );
}