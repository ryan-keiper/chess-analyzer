const originalEnv = process.env;

// Mock the @supabase/supabase-js module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('Supabase Service', () => {
  let mockCreateClient;
  let mockSupabaseClient;

  beforeEach(() => {
    // Clear require cache first
    jest.resetModules();
    
    // Reset environment
    process.env = { ...originalEnv };
    
    // Create mock Supabase client
    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      auth: {
        getUser: jest.fn(),
        signOut: jest.fn()
      },
      rpc: jest.fn(),
      storage: {
        from: jest.fn()
      }
    };
    
    // Get the mocked createClient function and set it up
    const { createClient } = require('@supabase/supabase-js');
    mockCreateClient = createClient;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up the mock to return our client
    mockCreateClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Module Initialization', () => {
    test('should create Supabase client with correct environment variables', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn(), auth: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      // Import the module after setting env vars
      const { supabase } = require('../services/supabase');

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_service_key'
      );
      expect(supabase).toBe(mockClient);
    });

    test('should throw error when SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });

    test('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });

    test('should throw error when both environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });

    test('should throw error when environment variables are empty strings', () => {
      process.env.SUPABASE_URL = '';
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });

    test('should throw error when SUPABASE_URL is empty but SERVICE_ROLE_KEY exists', () => {
      process.env.SUPABASE_URL = '';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });

    test('should throw error when SERVICE_ROLE_KEY is empty but SUPABASE_URL exists', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';

      expect(() => {
        require('../services/supabase');
      }).toThrow('Missing Supabase environment variables. Please check your backend .env file.');
    });
  });

  describe('Client Configuration', () => {
    test('should use service role key for backend operations', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key_with_admin_access';

      const mockClient = { from: jest.fn(), auth: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      require('../services/supabase');

      // Verify it uses service role key (not anon key)
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'service_role_key_with_admin_access'
      );
    });

    test('should handle valid URL formats', () => {
      const validUrls = [
        'https://abc123.supabase.co',
        'https://project-name.supabase.co',
        'https://test-project-123.supabase.co'
      ];

      validUrls.forEach(url => {
        jest.resetModules();
        process.env.SUPABASE_URL = url;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_key';

        const mockClient = { from: jest.fn() };
        mockCreateClient.mockReturnValue(mockClient);

        const { supabase } = require('../services/supabase');

        expect(mockCreateClient).toHaveBeenCalledWith(url, 'test_key');
      });
    });

    test('should handle various service key formats', () => {
      const validKeys = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
        'sb-project-auth-token-1234567890',
        'service_role_key_123'
      ];

      validKeys.forEach(key => {
        jest.resetModules();
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = key;

        const mockClient = { from: jest.fn() };
        mockCreateClient.mockReturnValue(mockClient);

        const { supabase } = require('../services/supabase');

        expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', key);
      });
    });
  });

  describe('Module Exports', () => {
    test('should export supabase client', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { 
        from: jest.fn(),
        auth: jest.fn(),
        storage: jest.fn(),
        rpc: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockClient);

      const supabaseModule = require('../services/supabase');

      expect(supabaseModule).toHaveProperty('supabase');
      expect(supabaseModule.supabase).toBe(mockClient);
    });

    test('should only export supabase property', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const supabaseModule = require('../services/supabase');
      const exportedKeys = Object.keys(supabaseModule);

      expect(exportedKeys).toEqual(['supabase']);
    });
  });

  describe('Client Functionality', () => {
    test('should return working Supabase client instance', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockFrom = jest.fn();
      const mockAuth = jest.fn();
      const mockRpc = jest.fn();
      
      const mockClient = { 
        from: mockFrom,
        auth: mockAuth,
        rpc: mockRpc
      };
      
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      // Test that the client has expected methods
      expect(typeof supabase.from).toBe('function');
      expect(typeof supabase.auth).toBe('function');
      expect(typeof supabase.rpc).toBe('function');

      // Test that methods can be called
      supabase.from('test_table');
      supabase.auth.getUser();
      supabase.rpc('test_function');

      expect(mockFrom).toHaveBeenCalledWith('test_table');
      expect(mockAuth.getUser).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('test_function');
    });

    test('should support method chaining for queries', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockSelect = jest.fn(() => ({ eq: mockEq }));
      const mockEq = jest.fn(() => ({ data: [], error: null }));
      const mockFrom = jest.fn(() => ({ select: mockSelect }));
      
      const mockClient = { from: mockFrom };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      // Test method chaining
      const result = supabase.from('users').select('*').eq('id', 123);

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', 123);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle createClient throwing an error', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      mockCreateClient.mockImplementation(() => {
        throw new Error('Failed to create Supabase client');
      });

      expect(() => {
        require('../services/supabase');
      }).toThrow('Failed to create Supabase client');
    });

    test('should handle invalid URL format gracefully', () => {
      // Supabase createClient might not validate URL format immediately
      process.env.SUPABASE_URL = 'not-a-valid-url';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      expect(() => {
        require('../services/supabase');
      }).not.toThrow();

      expect(mockCreateClient).toHaveBeenCalledWith('not-a-valid-url', 'test_service_key');
    });

    test('should handle undefined environment variables during runtime', () => {
      // Set vars initially
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      // Clear env vars after initialization
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Client should still work since it was already created
      expect(supabase.from).toBeDefined();
      expect(() => supabase.from('test')).not.toThrow();
    });
  });

  describe('Development vs Production Configuration', () => {
    test('should work in development environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://dev-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'dev_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://dev-project.supabase.co',
        'dev_service_key'
      );
    });

    test('should work in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://prod-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'prod_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://prod-project.supabase.co',
        'prod_service_key'
      );
    });

    test('should work in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test-project.supabase.co',
        'test_service_key'
      );
    });
  });

  describe('Module Caching', () => {
    test('should return same client instance on multiple requires', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase: supabase1 } = require('../services/supabase');
      const { supabase: supabase2 } = require('../services/supabase');

      expect(supabase1).toBe(supabase2);
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    test('should create new client when module is reloaded', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockClient1 = { from: jest.fn() };
      const mockClient2 = { from: jest.fn() };
      
      mockCreateClient
        .mockReturnValueOnce(mockClient1)
        .mockReturnValueOnce(mockClient2);

      const { supabase: supabase1 } = require('../services/supabase');
      
      // Clear module cache and require again
      jest.resetModules();
      const { supabase: supabase2 } = require('../services/supabase');

      expect(supabase1).toBe(mockClient1);
      expect(supabase2).toBe(mockClient2);
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-world Usage Patterns', () => {
    test('should support typical database operations', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      // Mock typical query chain
      const mockInsert = jest.fn(() => ({ data: { id: 1 }, error: null }));
      const mockSelect = jest.fn(() => ({ data: [], error: null }));
      const mockUpdate = jest.fn(() => ({ eq: mockEq }));
      const mockDelete = jest.fn(() => ({ eq: mockEq }));
      const mockEq = jest.fn(() => ({ data: null, error: null }));
      
      const mockFrom = jest.fn(() => ({
        insert: mockInsert,
        select: mockSelect,
        update: mockUpdate,
        delete: mockDelete
      }));
      
      const mockClient = { from: mockFrom };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      // Test CRUD operations
      supabase.from('users').insert({ name: 'John' });
      supabase.from('users').select('*');
      supabase.from('users').update({ name: 'Jane' }).eq('id', 1);
      supabase.from('users').delete().eq('id', 1);

      expect(mockInsert).toHaveBeenCalledWith({ name: 'John' });
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Jane' });
      expect(mockDelete).toHaveBeenCalled();
    });

    test('should support RPC function calls', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockRpc = jest.fn(() => ({ data: [], error: null }));
      const mockClient = { rpc: mockRpc };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      supabase.rpc('get_opening_statistics');
      supabase.rpc('find_book_end', { epd_list: ['fen1', 'fen2'] });

      expect(mockRpc).toHaveBeenCalledWith('get_opening_statistics');
      expect(mockRpc).toHaveBeenCalledWith('find_book_end', { epd_list: ['fen1', 'fen2'] });
    });

    test('should support auth operations', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mockGetUser = jest.fn(() => ({ data: null, error: null }));
      const mockSignOut = jest.fn(() => ({ error: null }));
      const mockAuth = { getUser: mockGetUser, signOut: mockSignOut };
      const mockClient = { auth: mockAuth };
      
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      supabase.auth.getUser();
      supabase.auth.signOut();

      expect(mockGetUser).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle whitespace in environment variables', () => {
      process.env.SUPABASE_URL = '  https://test.supabase.co  ';
      process.env.SUPABASE_SERVICE_ROLE_KEY = '  test_service_key  ';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      const { supabase } = require('../services/supabase');

      // Should pass the values as-is (with whitespace)
      expect(mockCreateClient).toHaveBeenCalledWith(
        '  https://test.supabase.co  ',
        '  test_service_key  '
      );
    });

    test('should handle very long environment variable values', () => {
      const longUrl = 'https://' + 'a'.repeat(1000) + '.supabase.co';
      const longKey = 'sk_' + 'b'.repeat(1000);

      process.env.SUPABASE_URL = longUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = longKey;

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      expect(() => {
        require('../services/supabase');
      }).not.toThrow();

      expect(mockCreateClient).toHaveBeenCalledWith(longUrl, longKey);
    });

    test('should handle special characters in environment variables', () => {
      process.env.SUPABASE_URL = 'https://test-proj_123.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key-with-special_chars.123';

      const mockClient = { from: jest.fn() };
      mockCreateClient.mockReturnValue(mockClient);

      expect(() => {
        require('../services/supabase');
      }).not.toThrow();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test-proj_123.supabase.co',
        'key-with-special_chars.123'
      );
    });
  });
});