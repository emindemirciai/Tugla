'use client';

import Link from 'next/link';
import { AdminShell } from '../components/AdminShell';
import { StatusNote, useAdminData } from '../components/primitives';
import { t } from '../lib/i18n';

interface Overview {
  users: number;
  newUsersThisWeek: number;
  activeToday: number;
  sessions24h: number;
  publishedLevels: number;
  openReports: number;
  openTickets: number;
  flaggedSessionsThisWeek: number;
}

/**
 * Overview.
 *
 * Every figure links to the screen that can act on it: a number that says "3
 * open reports" is only useful if it takes you to the reports. Numbers that
 * demand attention (reports, tickets, flagged sessions) are highlighted when
 * they are not zero, so the dashboard has a shape at a glance instead of eight
 * identical boxes.
 */
export default function AdminDashboard() {
  const { data, loading, error } = useAdminData<Overview>('/admin/system/overview');

  const cards = data
    ? [
        { label: t('dash.users'), value: data.users, href: '/users', icon: '👥' },
        { label: t('dash.newUsers'), value: data.newUsersThisWeek, href: '/users', icon: '✨' },
        { label: t('dash.activeToday'), value: data.activeToday, href: '/analytics', icon: '📈' },
        { label: t('dash.sessions24h'), value: data.sessions24h, href: '/analytics', icon: '🎮' },
        {
          label: t('dash.publishedLevels'),
          value: data.publishedLevels,
          href: '/levels',
          icon: '🧱',
        },
        {
          label: t('dash.openReports'),
          value: data.openReports,
          href: '/moderation',
          icon: '🚩',
          alert: data.openReports > 0,
        },
        {
          label: t('dash.openTickets'),
          value: data.openTickets,
          href: '/support',
          icon: '✉️',
          alert: data.openTickets > 0,
        },
        {
          label: t('dash.flagged'),
          value: data.flaggedSessionsThisWeek,
          href: '/moderation',
          icon: '🔍',
          alert: data.flaggedSessionsThisWeek > 0,
        },
      ]
    : [];

  const sections = [
    { href: '/levels', label: t('nav.levels'), icon: '🧱', hint: t('dash.hint.levels') },
    { href: '/users', label: t('nav.users'), icon: '👥', hint: t('dash.hint.users') },
    {
      href: '/moderation',
      label: t('nav.moderation'),
      icon: '🚩',
      hint: t('dash.hint.moderation'),
    },
    { href: '/support', label: t('nav.support'), icon: '✉️', hint: t('dash.hint.support') },
    { href: '/tasks', label: t('nav.tasks'), icon: '🎯', hint: t('dash.hint.tasks') },
    {
      href: '/achievements',
      label: t('nav.achievements'),
      icon: '🏆',
      hint: t('dash.hint.achievements'),
    },
    { href: '/economy', label: t('nav.economy'), icon: '🛒', hint: t('dash.hint.economy') },
    { href: '/leagues', label: t('nav.leagues'), icon: '📊', hint: t('dash.hint.leagues') },
    { href: '/seasons', label: t('nav.seasons'), icon: '🗓️', hint: t('dash.hint.seasons') },
    {
      href: '/announcements',
      label: t('nav.announcements'),
      icon: '📣',
      hint: t('dash.hint.announcements'),
    },
    { href: '/flags', label: t('nav.flags'), icon: '🎛️', hint: t('dash.hint.flags') },
    { href: '/analytics', label: t('nav.analytics'), icon: '📈', hint: t('dash.hint.analytics') },
    { href: '/messages', label: t('nav.messages'), icon: '💬', hint: t('dash.hint.messages') },
    { href: '/audit', label: t('nav.audit'), icon: '📜', hint: t('dash.hint.audit') },
    { href: '/system', label: t('nav.system'), icon: '🩺', hint: t('dash.hint.system') },
  ];

  return (
    <AdminShell title={t('nav.overview')}>
      <StatusNote loading={loading} error={error} />

      <div className="stat-grid">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`stat-card stat-link ${card.alert ? 'stat-alert' : ''}`}
          >
            <span className="stat-icon" aria-hidden>
              {card.icon}
            </span>
            <strong>{card.value.toLocaleString('tr-TR')}</strong>
            <span>{card.label}</span>
          </Link>
        ))}
      </div>

      <h2 className="admin-section-title">{t('dash.sections')}</h2>
      <div className="section-grid">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="section-card">
            <span className="section-icon" aria-hidden>
              {section.icon}
            </span>
            <strong>{section.label}</strong>
            <span className="admin-sub">{section.hint}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
