import { useQuery } from '@tanstack/react-query';
import { api } from './apiClient';

export function useApplication() {
  return useQuery({
    queryKey: ['application'],
    queryFn: async () => (await api.get('/membership/application')).data.data,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/members/me/profile')).data.data,
  });
}

export function useCompletion() {
  return useQuery({
    queryKey: ['completion'],
    queryFn: async () => (await api.get('/members/me/completion')).data.data,
  });
}

export function useAddressData() {
  return useQuery({
    queryKey: ['reference', 'address-data'],
    queryFn: async () => (await api.get('/reference/address-data')).data.data,
    staleTime: Infinity,
  });
}

export function useIctDomains() {
  return useQuery({
    queryKey: ['reference', 'ict-domains'],
    queryFn: async () => (await api.get('/reference/ict-domains')).data.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => (await api.get('/members/me/documents')).data.data,
  });
}

export function useMyCvs() {
  return useQuery({
    queryKey: ['cvs'],
    queryFn: async () => (await api.get('/members/me/cv')).data.data,
  });
}

export function useCvTemplates() {
  return useQuery({
    queryKey: ['cv-templates'],
    queryFn: async () => (await api.get('/cv-templates')).data.data,
    staleTime: 5 * 60 * 1000,
  });
}
