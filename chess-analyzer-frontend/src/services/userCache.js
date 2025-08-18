// services/userCache.js
import { USER_TIERS } from './supabase';

const CACHE_KEYS = {
  TIER: 'userTier',
  SUBSCRIPTION: 'userSubscription',
  USAGE: 'dailyUsage'
};

const CACHE_DURATION = {
  TIER: 24 * 60 * 60 * 1000, // 24 hours (rarely changes)
  SUBSCRIPTION: 60 * 60 * 1000, // 1 hour
  USAGE: 5 * 60 * 1000 // 5 minutes (changes frequently)
};

/**
 * Generic cache functions
 */
const getCacheKey = (userId, type) => `${type}_${userId}`;

const isExpired = (timestamp, maxAge) => {
  return Date.now() - timestamp > maxAge;
};

const setCache = (userId, type, data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      userId
    };
    localStorage.setItem(getCacheKey(userId, type), JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

const getCache = (userId, type, maxAge) => {
  try {
    const cached = localStorage.getItem(getCacheKey(userId, type));
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Validate cache belongs to current user
    if (parsed.userId !== userId) {
      clearCache(userId, type);
      return null;
    }
    
    // Check if expired
    if (isExpired(parsed.timestamp, maxAge)) {
      clearCache(userId, type);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
};

const clearCache = (userId, type) => {
  try {
    localStorage.removeItem(getCacheKey(userId, type));
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
};

/**
 * User Tier Caching
 */
export const getCachedTier = (userId) => {
  const cached = getCache(userId, CACHE_KEYS.TIER, CACHE_DURATION.TIER);
  return cached ? USER_TIERS[cached] || USER_TIERS.FREE : null;
};

export const setCachedTier = (userId, tierName) => {
  setCache(userId, CACHE_KEYS.TIER, tierName);
};

/**
 * Subscription Info Caching (for future use)
 */
export const getCachedSubscription = (userId) => {
  return getCache(userId, CACHE_KEYS.SUBSCRIPTION, CACHE_DURATION.SUBSCRIPTION);
};

export const setCachedSubscription = (userId, subscriptionData) => {
  setCache(userId, CACHE_KEYS.SUBSCRIPTION, subscriptionData);
};

/**
 * Daily Usage Caching (for usage limits)
 */
export const getCachedUsage = (userId) => {
  const cached = getCache(userId, CACHE_KEYS.USAGE, CACHE_DURATION.USAGE);
  return cached || { count: 0, date: new Date().toISOString().split('T')[0] };
};

export const setCachedUsage = (userId, usageData) => {
  setCache(userId, CACHE_KEYS.USAGE, usageData);
};

/**
 * Clear all cache for a user (on logout)
 */
export const clearUserCache = (userId) => {
  Object.values(CACHE_KEYS).forEach(key => {
    clearCache(userId, key);
  });
};

/**
 * Cache validation - call this before critical operations
 */
export const validateTierFromDB = async (user, fetchUserTier) => {
  try {
    const realTier = await fetchUserTier(user);
    
    // Update cache with fresh data
    setCachedTier(user.id, realTier.name);
    
    return realTier;
  } catch (error) {
    console.error('Tier validation failed:', error);
    return USER_TIERS.FREE;
  }
};