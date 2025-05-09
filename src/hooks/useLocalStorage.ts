'use client';

import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // useEffect to update local storage when the state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore =
          typeof storedValue === 'function'
            ? (storedValue as (val: T) => T)(storedValue)
            : storedValue;
        // Save state
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        // A more advanced implementation would handle the error case
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);


  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage (moved to useEffect to handle server-side rendering initial state correctly)
    } catch (error) {
      console.log(error);
    }
  };


  // To handle initial hydration mismatch, we ensure the component initially renders with `initialValue`
  // and then updates to the `localStorage` value on the client-side.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted && typeof window !== 'undefined') {
     try {
      const item = window.localStorage.getItem(key);
      const valueFromStorage = item ? JSON.parse(item) : initialValue;
      if (JSON.stringify(valueFromStorage) !== JSON.stringify(storedValue)) {
         // This might cause a re-render, but it's necessary to sync with localStorage post-hydration
         // For more complex scenarios, consider libraries designed for this or more nuanced effect logic
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}" during hydration check:`, error);
    }
  }


  return [storedValue, setValue];
}

export default useLocalStorage;
