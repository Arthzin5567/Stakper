-- =====================================================================
-- Banco de Dados: Stakper
-- SGBD: MySQL 8.0+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS Stakper
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE Stakper;

-- ---------------------------------------------------------------------
-- Tabela: usuario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario BIGINT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha_hash VARCHAR(255),
    id_provedor_login VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP NULL,
    status_conta ENUM('ativa', 'desativada', 'excluida') NOT NULL DEFAULT 'ativa',
    
    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT uq_usuario_provedor UNIQUE (id_provedor_login)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: plano
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plano (
    id_plano BIGINT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    descricao TEXT,
    preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    preco_anual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    limite_tarefas INT,
    limite_eventos INT,
    limite_sessoes_foco_diarias INT,
    notificacoes_customizadas BOOLEAN NOT NULL DEFAULT FALSE,
    remocao_publicidade BOOLEAN NOT NULL DEFAULT FALSE,
    suporte_prioritario BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_plano PRIMARY KEY (id_plano),
    CONSTRAINT uq_plano_nome UNIQUE (nome),
    CONSTRAINT ck_plano_preco_mensal CHECK (preco_mensal >= 0),
    CONSTRAINT ck_plano_preco_anual CHECK (preco_anual >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: tarefa
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefa (
    id_tarefa BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_limite TIMESTAMP NULL,
    prioridade ENUM('baixa', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
    status ENUM('nao_iniciada', 'em_progresso', 'concluida', 'bloqueada', 'cancelada') NOT NULL DEFAULT 'nao_iniciada',
    concluida_em TIMESTAMP NULL,
    chave_idempotencia VARCHAR(100) NOT NULL,
    
    CONSTRAINT pk_tarefa PRIMARY KEY (id_tarefa),
    CONSTRAINT fk_tarefa_usuario FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT ck_tarefa_concluida_em CHECK (concluida_em IS NULL OR status = 'concluida'),
    CONSTRAINT uq_tarefa_usuario_idempotencia UNIQUE (id_usuario, chave_idempotencia)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: evento_calendario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_calendario (
    id_evento BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP NOT NULL,
    data_fim TIMESTAMP NULL,
    
    CONSTRAINT pk_evento_calendario PRIMARY KEY (id_evento),
    CONSTRAINT fk_evento_usuario FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT ck_evento_data_fim CHECK (data_fim IS NULL OR data_fim >= data_inicio)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: sessao_foco
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessao_foco (
    id_sessao BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    id_tarefa BIGINT,
    inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim TIMESTAMP NULL,
    duracao_planejada_minutos INT NOT NULL,
    duracao_real_minutos INT,
    status ENUM('planejada', 'em_execucao', 'concluida', 'pausada', 'abandonada') NOT NULL DEFAULT 'planejada',
    
    CONSTRAINT pk_sessao_foco PRIMARY KEY (id_sessao),
    CONSTRAINT fk_sessao_usuario FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_sessao_tarefa FOREIGN KEY (id_tarefa) 
        REFERENCES tarefa (id_tarefa) ON DELETE SET NULL,
    CONSTRAINT ck_sessao_duracao_planejada CHECK (duracao_planejada_minutos > 0),
    CONSTRAINT ck_sessao_duracao_real CHECK (duracao_real_minutos IS NULL OR duracao_real_minutos >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: notificacao
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacao (
    id_notificacao BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    id_tarefa BIGINT,
    id_evento BIGINT,
    titulo VARCHAR(150) NOT NULL,
    mensagem TEXT,
    tipo ENUM('lembrete_tarefa', 'lembrete_evento', 'noticia_app', 'alteracao_tarefa') NOT NULL,
    data_agendada TIMESTAMP NOT NULL,
    data_envio TIMESTAMP NULL,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    
    CONSTRAINT pk_notificacao PRIMARY KEY (id_notificacao),
    CONSTRAINT fk_notificacao_usuario FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_notificacao_tarefa FOREIGN KEY (id_tarefa) 
        REFERENCES tarefa (id_tarefa) ON DELETE CASCADE,
    CONSTRAINT fk_notificacao_evento FOREIGN KEY (id_evento) 
        REFERENCES evento_calendario (id_evento) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabela: assinatura
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assinatura (
    id_assinatura BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    id_plano BIGINT NOT NULL,
    data_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_fim TIMESTAMP NULL,
    status ENUM('ativa', 'cancelada', 'pausada', 'expirada') NOT NULL DEFAULT 'ativa',
    periodicidade ENUM('mensal', 'anual') NOT NULL,
    proxima_renovacao TIMESTAMP NULL,
    
    CONSTRAINT pk_assinatura PRIMARY KEY (id_assinatura),
    CONSTRAINT uq_assinatura_usuario UNIQUE (id_usuario),
    CONSTRAINT fk_assinatura_usuario FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_assinatura_plano FOREIGN KEY (id_plano) 
        REFERENCES plano (id_plano) ON DELETE RESTRICT
) ENGINE = InnoDB;
