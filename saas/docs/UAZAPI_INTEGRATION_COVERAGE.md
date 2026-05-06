# Cobertura da integração UAZAPI

Este documento compara a especificação `docs/uazapi-openapi-spec.yaml` com a integração real da Ruptur Cloud.

## Situação atual

A OpenAPI da UAZAPI expõe 134 operações. A base da Ruptur agora usa `modules/provider-adapter/uazapi-adapter.js` como ponto principal de integração e mantém `integrations/uazapi/client.js` apenas como compatibilidade para módulos legados.

## Implementado de verdade

### Administração e instâncias

- `POST /instance/create`
- `GET /instance/all`
- `POST /instance/connect`
- `POST /instance/disconnect`
- `POST /instance/reset`
- `GET /instance/status`
- `GET /instance/wa_messages_limits`
- `POST /instance/updateInstanceName`
- `POST /instance/updateAdminFields`
- `DELETE /instance`
- `POST /instance/presence`
- `POST /instance/updateDelaySettings`

### Proxy

- `GET /instance/proxy`
- `POST /instance/proxy`
- `DELETE /instance/proxy`

### Perfil, privacidade e webhooks

- `POST /profile/name`
- `POST /profile/image`
- `GET /instance/privacy`
- `POST /instance/privacy`
- `GET /webhook`
- `POST /webhook`
- `GET /webhook/errors`
- `GET /globalwebhook`
- `POST /globalwebhook`
- `GET /globalwebhook/errors`

### Mensagens

- `POST /send/text`
- `POST /send/media`
- `POST /send/contact`
- `POST /send/location`
- `POST /send/menu`
- `POST /send/carousel`
- `POST /send/pix-button`
- `POST /send/request-payment`
- `GET /message/async`
- `DELETE /message/async`
- `POST /message/download`
- `POST /message/find`
- `POST /message/history-sync`
- `POST /message/markread`
- `POST /message/react`
- `POST /message/delete`
- `POST /message/edit`
- `POST /message/pin`

### Chats, contatos, etiquetas e Business

- `GET /contacts`
- `POST /contacts/list`
- `POST /contact/add`
- `POST /contact/remove`
- `POST /chat/check`
- `POST /chat/find`
- `POST /chat/details`
- `POST /chat/read`
- `POST /chat/archive`
- `POST /chat/mute`
- `POST /chat/pin`
- `GET /labels`
- `POST /labels/refresh`
- `POST /label/edit`
- `POST /business/get/profile`
- `GET /business/get/categories`
- `POST /business/update/profile`

## Compatibilidade corrigida

- `integrations/uazapi/client.js` deixou de usar `Authorization: Bearer` como padrão e passou a usar os headers oficiais da UAZAPI:
  - `admintoken` para endpoints administrativos;
  - `token` para endpoints de instância.
- `InboxManager` esperava `sendMessage()`, mas o client legado não possuía este método. O método foi adicionado com roteamento para texto, mídia, menu, carrossel e contato.
- O vínculo de tenant agora aceita tanto o padrão novo `tenant:<uuid>` quanto o legado `<uuid>`, evitando que o sync perca instâncias antigas.

## Ainda não exposto em tela/rota interna

Os métodos acima existem na camada de adapter, mas nem todos foram expostos para usuário final. Antes de criar telas, cada ação precisa passar por:

1. validação de tenant;
2. RBAC;
3. auditoria;
4. rate limit quando aplicável;
5. tratamento de idempotência para webhooks e mensagens;
6. controle de consumo/créditos.

## Ainda pendente da OpenAPI

Ainda não foram encapsulados de forma dedicada no adapter:

- grupos e comunidades;
- newsletters/canais;
- chamadas;
- respostas rápidas;
- Chatwoot;
- catálogo completo Business;
- sender/mensagem em massa nativo da UAZAPI;
- operações detalhadas de bloqueio e notas internas.

## Próxima etapa recomendada

Criar rotas internas seguras para o primeiro bloco operacional:

- instância: reset, disconnect, delete, limits, delay settings;
- webhook: configurar e consultar erros;
- envio: text/media/menu/contact/location;
- inbox: find, history-sync, markread, react;
- contatos: check e list.

Depois disso, plugar as ações nas telas de Admin, Cliente e Inbox.
