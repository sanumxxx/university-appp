// context/auth.js - updated with improved role handling
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

      // Return home route based on user role
      return getRoleBasedHomeRoute(userData.userType);
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

  // Helper function to get home route based on user role
  const getRoleBasedHomeRoute = (userType) => {
    switch (userType) {
      case 'admin':
        return '/(admin)/dashboard';
      case 'teacher':
        return '/(teacher)/schedule';
      case 'student':
      default:
        return '/(student)/schedule';
    }
  };

  // Helper function to get profile route based on user role
  const getRoleBasedProfileRoute = (userType) => {
    switch (userType) {
      case 'admin':
        return '/(admin)/profile';
      case 'teacher':
        return '/(teacher)/profile';
      case 'student':
      default:
        return '/(student)/profile';
    }
  };

  // Calculate whether the user is an admin, teacher, or student
  const isAdmin = user && user.userType === 'admin';
  const isTeacher = user && user.userType === 'teacher';
  const isStudent = user && user.userType === 'student';

  return (
    <AuthContext.Provider value={{
      isLoading,
      user,
      // Role flags for easy checking
      isAdmin,
      isTeacher,
      isStudent,
      // Auth actions
      login,
      logout,
      // Helper functions
      getHomeRoute: () => getRoleBasedHomeRoute(user?.userType),
      getProfileRoute: () => getRoleBasedProfileRoute(user?.userType)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);