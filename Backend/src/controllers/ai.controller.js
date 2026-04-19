const { generateContent, normalizeLanguageHint } = require('../services/ai.services');

const extractLanguageDirective = (rawCode) => {
  const text = (rawCode || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyIndex === -1) {
    return { code: rawCode || '', language: 'auto' };
  }

  const firstLine = lines[firstNonEmptyIndex].trim();
  const slashDirective = firstLine.match(/^\/\s*([a-zA-Z][a-zA-Z0-9+\-#]*)\s*$/);
  const keywordDirective = firstLine.match(/^(?:lang|language)\s*[:=]\s*([a-zA-Z][a-zA-Z0-9+\-#]*)\s*$/i);
  const directive = slashDirective?.[1] || keywordDirective?.[1];

  if (!directive) {
    return { code: rawCode || '', language: 'auto' };
  }

  const normalizedLanguage = normalizeLanguageHint(directive);
  lines.splice(firstNonEmptyIndex, 1);

  return {
    code: lines.join('\n').trim(),
    language: normalizedLanguage,
  };
};

const getAIReview = async (req, res) => {
  try {
    const code = req.body.code;
    const requestedLanguage = normalizeLanguageHint(req.body.language || 'auto');
    const focusMode = req.body.focusMode || 'full';

    if (!code || code.trim() === '') {
      return res.status(400).json({ error: 'Code is required' });
    }

    const isCodeLikely = (text) => {
      const codeSymbols = /[{}[\]()=;<>]/;
      const keywords = /\b(function|def|class|let|const|var|import|return|console|print|if|for|while)\b/;
      return codeSymbols.test(text) || keywords.test(text);
    };

    if (!isCodeLikely(code)) {
      return res.status(400).json({ 
        error: 'this type of text is not accept here you can paste your code here not coversational chat here' 
      });
    }

    const extracted = extractLanguageDirective(code);
    const effectiveLanguage =
      requestedLanguage !== 'auto' ? requestedLanguage : extracted.language;
    const effectiveCode = extracted.code || code;

    const response = await generateContent({
      prompt: effectiveCode,
      language: effectiveLanguage,
      focusMode,
    });

    return res.json({ review: response });
  } catch (error) {
    const isQuotaExceeded = 
      error?.message?.includes('quota') || 
      error?.details?.[0]?.violations?.[0]?.quotaMetric === 'generativelanguage.googleapis.com/generate_content_free_tier_requests' ||
      error?.status === 'RESOURCE_EXHAUSTED';
    
    const isUnavailable = 
      error?.code === 503 || 
      error?.status === 'UNAVAILABLE';

    let status = 500;
    let errorMessage = 'Internal Server Error';

    if (error?.message?.startsWith('400:')) {
      status = 400;
      errorMessage = error.message.substring(4).trim();
    } else if (isQuotaExceeded) {
      status = 429;
      errorMessage = 'API quota exceeded. Please try again tomorrow or upgrade your plan. https://ai.google.dev/pricing';
    } else if (isUnavailable) {
      status = 503;
      errorMessage = 'AI service is temporarily unavailable. Please retry in a few seconds.';
    }

    return res.status(status).json({
      error: errorMessage,
      details: error?.message,
    });
  }
};

module.exports = { getAIReview };