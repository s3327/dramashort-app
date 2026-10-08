import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isValidTheme,
  getThemeColor,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  VALID_THEMES,
  THEME_COLORS,
} from "@/contexts/ThemeContext";

const ROOT = process.cwd();

test("Task 14.7: ThemeContext exports valid theme constants and helpers", () => {
  assert.equal(THEME_COOKIE_NAME, "dramashort-theme");
  assert.equal(THEME_STORAGE_KEY, "dramashort-theme");
  assert.ok(VALID_THEMES.includes("light"));
  assert.ok(VALID_THEMES.includes("soft"));
  assert.ok(VALID_THEMES.includes("dark"));

  assert.equal(isValidTheme("light"), true);
  assert.equal(isValidTheme("soft"), true);
  assert.equal(isValidTheme("dark"), true);
  assert.equal(isValidTheme("invalid"), false);
  assert.equal(isValidTheme(null), false);
  assert.equal(isValidTheme(undefined), false);

  assert.equal(getThemeColor("light"), "#FFFFFF");
  assert.equal(getThemeColor("soft"), "#F3E7EA");
  assert.equal(getThemeColor("dark"), "#1C1220");
});

test("Task 14.7: Root layout sets data-theme, colorScheme, and themeColor on server from cookie", () => {
  const layoutPath = path.join(ROOT, "app", "layout.tsx");
  const content = fs.readFileSync(layoutPath, "utf-8");

  // Server Component reading cookies
  assert.ok(content.includes('import { cookies } from "next/headers";'), "layout.tsx must import cookies from next/headers");
  assert.ok(content.includes("await cookies()"), "layout.tsx must await cookies() on the server");
  assert.ok(
    content.includes("THEME_COOKIE_NAME") || content.includes(THEME_COOKIE_NAME),
    "layout.tsx must read the dramashort-theme cookie"
  );

  // Decorates <html> element
  assert.ok(content.includes("data-theme={initialTheme}"), "layout.tsx must decorate <html> with data-theme={initialTheme}");
  assert.ok(content.includes("style={{ colorScheme }}"), "layout.tsx must decorate <html> with style={{ colorScheme }}");

  // Injects pre-hydration synchronization script and theme-color meta tag
  assert.ok(content.includes('<meta name="theme-color"'), "layout.tsx must declare <meta name='theme-color'>");
  assert.ok(
    content.includes("dangerouslySetInnerHTML") &&
      (content.includes("THEME_COOKIE_NAME") || content.includes(THEME_COOKIE_NAME)),
    "layout.tsx must inject pre-hydration sync script to prevent flash for existing localStorage visitors"
  );

  // Passes initialTheme to ThemeProvider
  assert.ok(
    content.includes("<ThemeProvider initialTheme={initialTheme}>"),
    "layout.tsx must pass initialTheme to ThemeProvider to prevent hydration mismatch"
  );
});

test("Task 14.7: ThemeContext updates cookie, localStorage, colorScheme, and theme-color meta tag", () => {
  const contextPath = path.join(ROOT, "contexts", "ThemeContext.tsx");
  const content = fs.readFileSync(contextPath, "utf-8");

  assert.ok(content.includes("document.documentElement.setAttribute(\"data-theme\", next)"), "setTheme must update documentElement data-theme attribute");
  assert.ok(content.includes("document.documentElement.style.colorScheme"), "setTheme must update documentElement colorScheme");
  assert.ok(content.includes("document.cookie ="), "setTheme must write to document.cookie");
  assert.ok(content.includes("window.localStorage.setItem"), "setTheme must write to localStorage");
  assert.ok(content.includes('meta[name="theme-color"]'), "setTheme must synchronize theme-color meta tag");
});

test("Task 14.7: Loading screen eliminates hardcoded bg-white flash in favor of theme tokens", () => {
  const loadingPath = path.join(ROOT, "app", "loading.tsx");
  const content = fs.readFileSync(loadingPath, "utf-8");

  assert.ok(!content.includes("bg-white"), "loading.tsx must NOT contain hardcoded bg-white");
  assert.ok(content.includes("bg-bg text-text"), "loading.tsx must use semantic theme tokens bg-bg text-text");
});

test("Task 14.7: Admin layout isolates console in light theme and auth pages preserve dark branding", () => {
  const adminLayoutPath = path.join(ROOT, "app", "admin", "layout.tsx");
  const adminContent = fs.readFileSync(adminLayoutPath, "utf-8");
  assert.ok(adminContent.includes('data-theme="light"'), "Admin layout must enforce data-theme='light'");

  const loginContent = fs.readFileSync(path.join(ROOT, "app", "login", "page.tsx"), "utf-8");
  const signupContent = fs.readFileSync(path.join(ROOT, "app", "signup", "page.tsx"), "utf-8");
  const forgotContent = fs.readFileSync(path.join(ROOT, "app", "forgot-password", "page.tsx"), "utf-8");
  const resetContent = fs.readFileSync(path.join(ROOT, "app", "reset-password", "page.tsx"), "utf-8");
  const verifyContent = fs.readFileSync(path.join(ROOT, "app", "verify-email", "page.tsx"), "utf-8");

  assert.ok(loginContent.includes('data-theme="dark"'), "Login page must declare data-theme='dark'");
  assert.ok(signupContent.includes('data-theme="dark"'), "Signup page must declare data-theme='dark'");
  assert.ok(forgotContent.includes('data-theme="dark"'), "Forgot password page must declare data-theme='dark'");
  assert.ok(resetContent.includes('data-theme="dark"'), "Reset password page must declare data-theme='dark'");
  assert.ok(verifyContent.includes('data-theme="dark"'), "Verify email page must declare data-theme='dark'");
});

test("Task 14.7: Error boundary and not-found boundary bind theme properly", () => {
  const errorContent = fs.readFileSync(path.join(ROOT, "app", "error.tsx"), "utf-8");
  const notFoundContent = fs.readFileSync(path.join(ROOT, "app", "not-found.tsx"), "utf-8");

  assert.ok(errorContent.includes("data-theme={activeTheme}"), "error.tsx must bind active theme");
  assert.ok(notFoundContent.includes("data-theme={theme}"), "not-found.tsx must bind active theme");
});
