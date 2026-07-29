import { describe, expect, it } from 'vitest';
import type { Category } from '@finmanager/schema';

import {
  CUSTOM_CATEGORY_COLOR,
  CUSTOM_CATEGORY_ICON,
  DEFAULT_CATEGORIES,
  isCategoryIconKey,
  resolveCategoryPresentation,
  withCustomCategoryPresentation,
} from './categories.js';

describe('DEFAULT_CATEGORIES', () => {
  it('defines the 21 categories provisioned for every new user', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(21);
  });

  it('does not repeat a template key or initial name/kind pair', () => {
    expect(new Set(DEFAULT_CATEGORIES.map((category) => category.key)).size).toBe(
      DEFAULT_CATEGORIES.length,
    );
    expect(
      new Set(DEFAULT_CATEGORIES.map((category) => `${category.kind}:${category.name}`)).size,
    ).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('category presentation', () => {
  const customCategory = {
    userId: 'user',
    name: 'Pet care',
    kind: 'expense',
    icon: null,
    color: null,
    parentId: null,
    isSystem: false,
    sortOrder: 999,
  } as Category;

  it('preserves every provisioned icon and color', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(isCategoryIconKey(category.icon)).toBe(true);
      expect(resolveCategoryPresentation(category)).toEqual({
        icon: category.icon,
        color: category.color,
      });
    }
  });

  it('uses the semantic tag and brand teal for null or unknown legacy values', () => {
    expect(resolveCategoryPresentation(customCategory)).toEqual({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
    expect(resolveCategoryPresentation({ icon: 'stale-icon', color: '   ' })).toEqual({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
    expect(resolveCategoryPresentation({ icon: 'tag', color: 'not-a-colour' })).toEqual({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
    expect(resolveCategoryPresentation(undefined)).toEqual({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
  });

  it('applies fixed presentation to a custom category prepared for insertion', () => {
    expect(withCustomCategoryPresentation(customCategory)).toMatchObject({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
    expect(
      withCustomCategoryPresentation({
        ...customCategory,
        id: 'preassigned',
        icon: null,
        color: null,
      }),
    ).toMatchObject({
      icon: CUSTOM_CATEGORY_ICON,
      color: CUSTOM_CATEGORY_COLOR,
    });
  });
});
