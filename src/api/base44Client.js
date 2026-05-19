import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

function isFunctionMissingError(error) {
  return error?.status === 404
    || error?.response?.status === 404
    || /status code 404|not found/i.test(error?.message || '');
}

function createMissingFunctionError(name, error) {
  const wrapped = new Error(`Backend-Funktion ${name} ist nicht deployed oder nicht registriert. Keine lokalen Browser-Fallbacks aktiv.`);
  wrapped.errorCode = 'BACKEND_FUNCTION_NOT_DEPLOYED';
  wrapped.technicalMessage = error?.message || String(error || 'missing function');
  wrapped.humanMessage = `Die Backend-Funktion ${name} fehlt. StudioSoundSet simuliert keine Commands, Logins oder Spotify-Aktionen im Browser.`;
  wrapped.suggestedFix = `Base44 Function ${name} deployen/registrieren und die App neu publishen.`;
  return wrapped;
}

const originalInvoke = client.functions.invoke.bind(client.functions);

client.functions.invoke = async (name, payload) => {
  try {
    return await originalInvoke(name, payload);
  } catch (error) {
    if (isFunctionMissingError(error)) {
      throw createMissingFunctionError(name, error);
    }
    throw error;
  }
};

export const base44 = client;
