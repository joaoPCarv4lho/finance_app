// Service worker mínimo: existe apenas para satisfazer o critério de
// instalabilidade do Chrome (exige um service worker ativo). Não
// intercepta nem cacheia nada — o app continua exigindo rede.
self.addEventListener('fetch', () => {})
