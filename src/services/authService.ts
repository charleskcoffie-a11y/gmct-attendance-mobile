// Authentication Service for GMCT Members
// Handles member authentication using Supabase Auth with email format: {classNumber}@gmct.member

import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { Member } from '../types';

interface ClassLeaderMapping {
  classNumber?: number;
  classLeaderId?: string;
  classLeaderName?: string;
}

export class AuthService {
  /**
   * Sign in with class number and password
   * Converts classNumber to internal email format: {classNumber}@gmct.member
   */
  async signIn(classNumber: string, password: string) {
    try {
      const email = this.classNumberToEmail(classNumber);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { data: null, error: error.message || 'Sign in failed' };
    }
  }

  /**
   * Sign up new member (admin function)
   * Creates authentication account with default password
   */
  async signUp(classNumber: string, password: string = 'gmct2026') {
    try {
      const email = this.classNumberToEmail(classNumber);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            class_number: classNumber,
            password_changed: false,
          },
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { data: null, error: error.message || 'Sign up failed' };
    }
  }

  /**
   * Check if this is the user's first login
   * Uses auth user metadata field 'password_changed'
   */
  async isFirstLogin(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      const metadata = user.user_metadata;
      const changed = metadata?.password_changed;

      if (typeof changed === 'boolean') {
        return !changed;
      }

      if (typeof changed === 'string') {
        return changed.toLowerCase() !== 'true';
      }

      return true;
    } catch (error) {
      console.error('Error checking first login:', error);
      return true;
    }
  }

  /**
   * Update password and mark first-login flow as completed
   */
  async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          password_changed: true,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      console.error('Update password error:', error);
      return { data: null, error: error.message || 'Password update failed' };
    }
  }

  /**
   * Change password with current-password verification.
   * Members must provide the old password before setting a new one.
   */
  async changePasswordWithOldPassword(
    oldPassword: string,
    newPassword: string,
    memberEmailOrClassNumber?: string
  ) {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const fallbackIdentifier = memberEmailOrClassNumber?.trim();
      const fallbackEmail = fallbackIdentifier
        ? fallbackIdentifier.includes('@')
          ? fallbackIdentifier.toLowerCase()
          : this.classNumberToEmail(fallbackIdentifier)
        : null;

      const userEmail = session?.user?.email || fallbackEmail;

      if (!userEmail) {
        return { data: null, error: 'Unable to identify account. Please log in again and retry.' };
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseAnonKey) {
        return { data: null, error: 'Supabase configuration is missing' };
      }

      // Use a non-persistent client so we can verify credentials without replacing
      // the currently active in-app session.
      const verifierClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { error: verifyError } = await verifierClient.auth.signInWithPassword({
        email: userEmail,
        password: oldPassword,
      });

      // Cleanup verifier session regardless of success/failure.
      await verifierClient.auth.signOut();

      if (verifyError) {
        if (verifyError.message?.includes('Invalid login credentials')) {
          return { data: null, error: 'Old password is incorrect' };
        }
        throw verifyError;
      }

      // If session is missing (or belongs to a different email), re-authenticate on
      // the main client so updateUser has a valid authenticated context.
      if (!session?.access_token || session.user?.email?.toLowerCase() !== userEmail.toLowerCase()) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: oldPassword,
        });

        if (signInError) {
          if (signInError.message?.includes('Invalid login credentials')) {
            return { data: null, error: 'Old password is incorrect' };
          }
          throw signInError;
        }
      }

      const updateResult = await this.updatePassword(newPassword);
      if (updateResult.error) {
        return updateResult;
      }

      // Confirm new password can authenticate. This gives immediate confidence
      // that the password was actually changed.
      const { error: verifyNewError } = await verifierClient.auth.signInWithPassword({
        email: userEmail,
        password: newPassword,
      });
      await verifierClient.auth.signOut();

      if (verifyNewError) {
        return { data: null, error: 'Password update could not be verified. Please try again.' };
      }

      return updateResult;
    } catch (error: any) {
      console.error('Change password with old password error:', error);
      return { data: null, error: error.message || 'Password change failed' };
    }
  }

  /**
   * Retrieve member information from the members table and resolve
   * whether the member is also an active class leader.
   */
  async getCurrentMemberInfo(): Promise<Member | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) return null;

      const { data, error } = await supabase
        .from('members')
        .select('id, name, email, class_number, member_number, phone, address, city, province, date_of_birth, dob_month, dob_day, day_born, active, dev_fund_pledge, created_at')
        .eq('email', user.email)
        .single();

      if (error) {
        console.error('Error fetching member info:', error);
        return null;
      }

      const leaderMapping = await this.resolveClassLeaderMapping(user.email);

      const member: Member = {
        id: data.id,
        name: data.name,
        email: data.email,
        class_number: data.class_number,
        member_number: data.member_number,
        assignedClass: leaderMapping.classNumber,
        classLeaderId: leaderMapping.classLeaderId,
        classLeaderName: leaderMapping.classLeaderName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        province: data.province,
        date_of_birth: data.date_of_birth,
        dob_month: data.dob_month,
        dob_day: data.dob_day,
        day_born: data.day_born,
        is_active: data.active,
        dev_fund_pledge: data.dev_fund_pledge,
        created_at: data.created_at,
      };

      return member;
    } catch (error) {
      console.error('Error getting current member:', error);
      return null;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      return { user, error: null };
    } catch (error: any) {
      console.error('Error getting current user:', error);
      return { user: null, error: error.message };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      return { error: null };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return { error: error.message || 'Sign out failed' };
    }
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event: string, session: any) => {
      callback(event, session);
    });
  }

  /**
   * Convert class number to email format
   * Example: A123 -> a123@gmct.member
   */
  private classNumberToEmail(classNumber: string): string {
    return `${classNumber.trim().toLowerCase()}@gmct.member`;
  }

  /**
   * Extract class number from email
   * Example: a123@gmct.member -> a123
   */
  emailToClassNumber(email: string): string {
    return email.split('@')[0] || '';
  }

  private normalizeIdentifier(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private parseClassNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Resolve class-leader mapping using explicit identity only.
   * A member becomes a class leader only when their auth email matches
   * an active class_leaders.email entry.
   */
  private async resolveClassLeaderMapping(authEmail: string): Promise<ClassLeaderMapping> {
    const normalizedEmail = this.normalizeIdentifier(authEmail);
    if (!normalizedEmail) return {};

    let leader: any | null = null;

    const { data: emailMatches, error: emailError } = await supabase
      .from('class_leaders')
      .select('id, class_number, full_name, username, email, active')
      .eq('active', true)
      .ilike('email', normalizedEmail)
      .limit(1);

    if (!emailError && emailMatches && emailMatches.length > 0) {
      leader = emailMatches[0];
    }

    if (!leader) {
      return {};
    }

    return {
      classNumber: this.parseClassNumber(leader.class_number),
      classLeaderId: leader.id,
      classLeaderName: leader.full_name || leader.username || undefined,
    };
  }

  /**
   * Parse authentication error messages into user-friendly text
   */
  parseError(errorMessage: string): string {
    if (errorMessage.includes('Invalid login credentials')) {
      return 'Invalid class number or password';
    }
    if (errorMessage.includes('User already registered')) {
      return 'This class number is already registered';
    }
    if (errorMessage.includes('Email not confirmed')) {
      return 'Please confirm your email address';
    }
    return 'An error occurred. Please try again.';
  }
}

// Export singleton instance
export const authService = new AuthService();
