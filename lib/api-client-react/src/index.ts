export * from "./generated/api";
export * from "./generated/api.schemas";
/** Explicit re-export: some Vite dev setups fail to resolve `useLogin` from `export *` across workspace boundaries. */
export { useLogin } from "./generated/api";
export {
  useListPendingInvites,
  useAcceptCampaignInvite,
  useDeclineCampaignInvite,
  useListPlayerCharacters,
  useGetSessionAiContext,
  getGetSessionAiContextQueryKey,
  usePostDmStoryAssistant,
  useDeleteCampaign,
  useCreateLivekitToken,
  useDeleteMessage,
  usePatchMessage,
} from "./generated/api";
export { setBaseUrl, setAuthTokenGetter, setTabIdGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
