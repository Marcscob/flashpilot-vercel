import type { ComponentType } from "react";
import { template as welcomeTemplate } from "./welcome";
import { template as trialEndedTemplate } from "./trial-ended";
import { template as trialDay9Template } from "./trial-day9";
import { template as trialDay14Template } from "./trial-day14";
import { template as subscriberWelcomeTemplate } from "./subscriber-welcome";
import { template as landingActivationTemplate } from "./landing-activation";
import { template as landingReminderTemplate } from "./landing-reminder";
import { template as blogSubscriptionConfirmationTemplate } from "./blog-subscription-confirmation";
import { template as blogNewPostTemplate } from "./blog-new-post";
import { template as blogCommentNotificationTemplate } from "./blog-comment-notification";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  "trial-ended": trialEndedTemplate,
  "trial-day9": trialDay9Template,
  "trial-day14": trialDay14Template,
  "subscriber-welcome": subscriberWelcomeTemplate,
  "landing-activation": landingActivationTemplate,
  "landing-reminder": landingReminderTemplate,
  "blog-subscription-confirmation": blogSubscriptionConfirmationTemplate,
  "blog-new-post": blogNewPostTemplate,
  "blog-comment-notification": blogCommentNotificationTemplate,
};
