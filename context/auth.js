// context/auth.js - updated with better isAdmin check
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        console.log('User authenticated:', parsedUser.userType);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData, token) => {
    try {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);

      console.log('User logged in as:', userData.userType);

      // Return base route depending on user role
      if (userData.userType === 'admin') {
        return '/(admin)/dashboard';
      } else {
        return '/(tabs)/schedule';
      }
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  // Calculate whether the user is an admin
  const isAdminUser = user && user.userType === 'admin';

  return (
    <AuthContext.Provider value={{
      isLoading,
      user,
      isAdmin: isAdminUser,  // Boolean flag for easy checking
      login,
      logout,
      // Helper function to determine the correct route for the user
      getHomeRoute: () => isAdminUser ? '/(admin)/dashboard' : '/(tabs)/schedule',
      getProfileRoute: () => isAdminUser ? '/(admin)/profile' : '/(tabs)/profile'
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);