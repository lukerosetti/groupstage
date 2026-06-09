import { create } from 'zustand';
import { getLocalUser, saveLocalUser } from '../lib/localUser';

const useUserStore = create((set) => ({
  user: getLocalUser(),
  setUser: (data) => {
    saveLocalUser(data);
    set({ user: { ...getLocalUser(), ...data } });
  },
  clearUser: () => set({ user: null }),
}));

export default useUserStore;
