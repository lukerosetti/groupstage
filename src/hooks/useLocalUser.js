import useUserStore from '../store/userStore';
export default function useLocalUser() {
  return useUserStore();
}
