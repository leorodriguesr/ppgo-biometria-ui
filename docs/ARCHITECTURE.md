# Arquitetura e Estratégia Técnica - Sistema Prisional (Biometria Facial)

## 1. Visão Geral da Arquitetura
A solução será baseada em uma arquitetura **Local-First (Offline)**, priorizando latência zero para reconhecimento facial e alta segurança dos dados sensíveis. O backend atua apenas como sincronizador eventual (quando houver rede), mas o *core business* roda no dispositivo (Edge Computing).

### Fluxo de Reconhecimento (identificação)
1. **React → Python:** envia a foto da face; Python gera o **embedding 512** e devolve ao app.
2. **React → Java:** envia o vetor (embedding) para o backend Java.
3. **Java → Banco:** compara o embedding com os cadastros no banco.
4. **Java → React:** retorna o resultado (match, preso_id, distance).

No **cadastro**, o React também usa Python para gerar o embedding 512; os dados e o embedding são persistidos no banco local (SQLite) e/ou enviados ao backend conforme a estratégia de sincronização.

### Componentes Chave:
1.  **Mobile App (Frontend & Edge Logic):**
    *   **Framework:** React Native (Expo Managed Workflow com Prebuild/CNG).
    *   **Justificativa:** O Expo moderno (SDK 52+) permite código nativo customizado via *Config Plugins*, eliminando a necessidade de "eject" e facilitando manutenção e upgrades do React Native. O *Prebuild* gera as pastas android/ios sob demanda, permitindo o uso de bibliotecas de alta performance como `react-native-vision-camera` e JSI modules sem a complexidade de manter um projeto *bare* manualmente.
2.  **Motor de Visão Computacional (On-Device ML):**
    *   Processamento de vetores faciais (Embeddings) rodando diretamente na CPU/GPU/NPU do dispositivo.
3.  **Banco de Dados Local Seguro:**
    *   SQLite com extensão de criptografia (SQLCipher) para dados textuais e vetoriais.

---

## 2. Stack Tecnológico Sugerido

### Câmera e Processamento de Imagem
*   **Biblioteca:** `react-native-vision-camera` (v4+).
    *   **Por que:** É a única biblioteca no ecossistema RN capaz de rodar *Frame Processors* síncronos em C++ via JSI (Worklets). Isso permite acessar o buffer da câmera a 30fps/60fps sem gargalos da "bridge" antiga do React Native.
    *   **Overlay:** Canvas desenhado com Skia (`@shopify/react-native-skia`) para guias visuais de alta performance (60fps) sobre o preview da câmera.

### Detecção e Reconhecimento Facial (O Desafio Crítico)
Reconhecimento facial envolve três etapas:
1.  **Detecção (Onde está o rosto?):**
    *   *Solução:* **Google ML Kit** (via `react-native-fast-tflite` ou wrapper específico como `react-native-mlkit-face-detection`) ou modelo SSD MobileNet. ML Kit é extremamente rápido e preciso para detecção.
2.  **Alinhamento (Normalizar pose):**
    *   Feito via software usando os "landmarks" (olhos, nariz, boca) retornados na detecção.
3.  **Extração de Embeddings (Quem é essa pessoa?):**
    *   *Solução:* **MobileFaceNet** (modelo .tflite customizado) rodando no `react-native-fast-tflite`.
    *   Este modelo converte a imagem do rosto em um vetor numérico (e.g., 128 floats).
    *   A comparação é feita calculando a *Distância Euclidiana* entre o vetor capturado e os vetores no banco de dados.

### Armazenamento e Segurança
*   **Banco de Dados:** `op-sqlite` (versão mais rápida do SQLite para RN, baseada em JSI).
*   **Criptografia:** SQLCipher integrado ao `op-sqlite`. Todo o banco é criptografado com chave derivada de senha forte (armazenada no SecureStore/Keystore do SO).
*   **Biometria:** Os templates (vetores) são salvos criptografados. A imagem original é salva no *FileSystem* (também criptografada ou em diretório privado do app sandbox) apenas se necessário para auditoria.

---

## 3. Estratégia de Captura e Validação (Anti-Spoofing & Qualidade)

Para garantir fotos padronizadas ("Padrão ICAO" simplificado para ambiente prisional), implementaremos um "Funil de Qualidade" no *Frame Processor*:

1.  **Validação Geométrica (Tempo Real):**
    *   **Enquadramento:** O rosto deve ocupar X% da área da tela (Bounding Box ratio).
    *   **Centralização:** O centro do rosto deve estar próximo ao centro da imagem (Offset X/Y).
    *   **Pose (Head Pose):** Euler Angles (Yaw, Pitch, Roll) devem estar próximos de 0 (frente total).
        *   *Feedback:* "Vire o rosto para frente", "Não incline a cabeça".

2.  **Validação de Qualidade de Imagem:**
    *   **Brilho:** Calcular a luminância média da região do rosto. Se < Threshold -> "Iluminação insuficiente".
    *   **Nitidez:** Laplaciano da imagem (detecção de bordas) para evitar fotos borradas.

3.  **Captura Automática (Auto-Capture):**
    *   O botão de "Tirar Foto" só é habilitado (ou dispara sozinho) quando todas as métricas acima estão "Verdes" por X milissegundos consecutivos. Isso evita fotos tremidas ou fora de padrão.

---

## 4. Fluxo de Telas Sugerido

1.  **Login Seguro:** Autenticação do Policial Penal (Biometria do dispositivo ou Senha Forte).
2.  **Dashboard Operacional:**
    *   Botão GIGANTE "Identificar Preso" (Ação rápida).
    *   Botão "Novo Cadastro".
    *   Busca manual (caso a biometria falhe).
3.  **Modo "Reconhecimento Contínuo" (Scanner):**
    *   Tela de câmera cheia.
    *   Identifica rostos em tempo real.
    *   Mostra card flutuante com foto, nome, cela e status (ex: "PERICULOSO", "ALVARÁ SOLTURA") ao reconhecer.
4.  **Wizard de Cadastro Biométrico:**
    *   Passo 1: Dados Pessoais (Nome, Mãe, RG/INFOPEN).
    *   Passo 2: Alocação (Pavilhão, Cela).
    *   Passo 3: Coleta Biométrica (A câmera com as guias rígidas).
    *   Passo 4: Revisão e Salvamento Local.

---

## 5. Limitações Técnicas e Mitigação em Mobile

| Limitação | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Performance de Busca 1:N** | Comparar 1 rosto contra 10.000 no celular é lento (O(N)). | Usar indexação vetorial se possível, ou dividir busca por "Unidade Prisional" (filtro prévio). Para < 2.000 presos, busca linear em vetor C++ é instantânea (< 100ms). |
| **Bateria e Aquecimento** | Processamento contínuo de vídeo + ML drena bateria. | Ativar reconhecimento apenas quando "necessário" (ex: detecção de movimento ou botão de pressão). Diminuir FPS do processamento (ex: processar 1 a cada 5 frames). |
| **Iluminação Ambiente** | Celas escuras ou pátios com sol forte afetam a precisão. | Usar normalização de histograma na imagem antes do processamento. Forçar uso de flash/lanterna em ambientes escuros (controlado pelo app). |
| **Spoofing (Foto de Foto)** | Presos podem tentar usar fotos de outros. | Implementar detecção de "Liveness" (piscar de olhos ou movimento sutil) passiva se possível, ou exigir movimento ("vire o rosto levemente") durante a identificação. |

---

## 6. Considerações de Segurança (LGPD & Security)
*   **Dados em Repouso:** Banco criptografado (AES-256).
*   **Dados em Memória:** Limpar variáveis contendo imagens brutas imediatamente após uso.
*   **Sandbox:** O Android/iOS já isola o app, mas evitar salvar fotos na "Galeria Pública". Usar armazenamento interno privado (`FileSystem.documentDirectory`).
*   **Audit Log:** Registrar *quem* consultou *quem* e *quando*.

Esta arquitetura garante um app robusto, rápido e seguro, focado na realidade operacional do sistema prisional.
