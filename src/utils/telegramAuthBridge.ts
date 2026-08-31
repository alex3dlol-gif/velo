import type { TelegramWidgetUser } from "../types/telegramAuth";

type TelegramAuthHandler = (user: TelegramWidgetUser) => void;

let handler: TelegramAuthHandler | null = null;

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

if (typeof window !== "undefined") {
  window.onTelegramAuth = (user) => {
    handler?.(user);
  };
}

export function setTelegramAuthHandler(next: TelegramAuthHandler | null) {
  handler = next;
}

const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"] as const;

export function parseTelegramAuthFromUrl(): TelegramWidgetUser | null {
  const params = new URLSearchParams(window.location.search);
  const hash = params.get("hash");
  const id = params.get("id");
  const firstName = params.get("first_name");
  const authDate = params.get("auth_date");

  if (!hash || !id || !firstName || !authDate) return null;

  const user: TelegramWidgetUser = {
    id: Number(id),
    first_name: firstName,
    auth_date: Number(authDate),
    hash,
  };

  const lastName = params.get("last_name");
  const username = params.get("username");
  const photoUrl = params.get("photo_url");
  if (lastName) user.last_name = lastName;
  if (username) user.username = username;
  if (photoUrl) user.photo_url = photoUrl;

  return user;
}

export function clearTelegramAuthFromUrl() {
  const url = new URL(window.location.href);
  for (const key of WIDGET_FIELDS) url.searchParams.delete(key);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getTelegramAuthCallbackUrl(): string {
  const url = new URL(window.location.href);
  for (const key of WIDGET_FIELDS) url.searchParams.delete(key);
  return `${url.origin}${url.pathname}${url.search}`;
}
