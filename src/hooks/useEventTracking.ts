import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sa_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('sa_session_id', sessionId);
  }
  return sessionId;
};

// Detect device type
const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

// Get UTM params from URL
const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
};

// Get stored email from sessionStorage
const getStoredEmail = () => sessionStorage.getItem('sa_user_email');

// Store email in sessionStorage
export const setStoredEmail = (email: string) => {
  sessionStorage.setItem('sa_user_email', email);
};

export const useEventTracking = () => {
  const sessionId = useRef(getSessionId());

  const trackEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, any> = {},
    options: {
      email?: string;
      campusId?: string;
      courseSlug?: string;
    } = {}
  ) => {
    try {
      const utmParams = getUtmParams();
      const email = options.email || getStoredEmail();

      await (supabase as any).from('student_events').insert({
        email,
        campus_id: options.campusId || null,
        course_slug: options.courseSlug || null,
        event_type: eventType,
        event_data: eventData,
        page_url: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        session_id: sessionId.current,
        device_type: getDeviceType(),
      });
    } catch (error) {
      console.error('Event tracking error:', error);
      // Don't throw - tracking should never break the app
    }
  }, []);

  // Track page view on mount
  const trackPageView = useCallback((pageName: string, data: Record<string, any> = {}) => {
    trackEvent('page_view', { page_name: pageName, ...data });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    setStoredEmail,
  };
};
