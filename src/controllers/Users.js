import * as Yup from 'yup';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import Mail from '../lib/mail';
import UsersModel from '../models/Users';
import PasswordHasher from '../services/password_hasher';

class Users {
  async login(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string()
        .email()
        .required('Email é obrigatório.'),
      password: Yup.string().required('Senha é obrigatória.'),
    });

    try {
      await schema.validate(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.errors });
    }

    const { email, password: provided_password } = req.body;

    const user = await UsersModel.find({ email });
    if (Array.isArray(user) && user.length) {
      const { id, name, password: stored_password, active } = user[0];

      if (active) {
        if (
          !(await PasswordHasher.compare(provided_password, stored_password))
        ) {
          return res
            .status(401)
            .json({ error: 'Usuário e/ou senha incorretos.' });
        }
        return res.json({
          user: {
            id,
            name,
            email,
          },
          token: jwt.sign({ id }, process.env.JWT_SECRET, {
            expiresIn: '0.5h',
          }),
        });
      }
      return res.status(403).json({ error: 'Usuário bloqueado.' });
    }
    return res.status(401).json({ error: 'Usuário e/ou senha incorretos.' });
  }

  async create(req, res) {
    const schema = Yup.object().shape({
      name: Yup.string().required('Nome é obrigatório'),
      email: Yup.string()
        .email()
        .required('Email é obrigatório'),
      password: Yup.string().required('Senha é obrigatória'),
      password_confirmation: Yup.string()
        .required()
        .oneOf([Yup.ref('password'), null], 'As senhas devem coincidir'),
    });

    try {
      await schema.validate(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.errors });
    }

    // eslint-disable-next-line prefer-const
    let { name, email, password } = req.body;
    let user;

    try {
      user = await UsersModel.find({ email });
    } catch (e) {
      return res.status(503).json({
        error: 'Não foi possível estabelecer uma conexão com o banco de dados.',
      });
    }

    if (Array.isArray(user) && !user.length) {
      password = await PasswordHasher.hash(password);
      const confirmation_token = crypto.randomBytes(8).toString('hex');
      const saved_user = await UsersModel.insert(['id', 'name', 'email'], {
        name,
        email,
        password,
        confirmation_token,
      });
      await Mail.sendMail({
        to: `${name} <${email}>`,
        subject: 'Confirmação de Cadastro',
        template: 'confirm_creation',
        context: {
          username: name,
          confirmation_url: `${process.env.APP_URL}/users/creation_confirmation/${confirmation_token}`,
        },
      });
      return res.json(saved_user);
    }
    return res.status(400).json({ error: 'Usuário já cadastrado.' });
  }

  async forgot_password(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string()
        .email()
        .required('Email é obrigatório'),
    });

    try {
      await schema.validate(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.errors });
    }
    const { email } = req.body;

    const user = await UsersModel.find({ email });

    if (Array.isArray(user) && user.length) {
      const reset_token = crypto.randomBytes(8).toString('hex');
      try {
        const name = await UsersModel.update(
          ['name'],
          { email },
          { reset_token }
        );
        await Mail.sendMail({
          to: `${name} <${email}>`,
          subject: 'Redefinição de Senha',
          template: 'reset_password',
          context: {
            username: name,
            confirmation_url: `${process.env.APP_URL}/users/reset_password/${reset_token}`,
          },
        });
      } catch (e) {
        return res
          .status(503)
          .json('Falha ao estabelecer conexão com banco de dados!');
      }
    }
    return res.json(
      `Se ${email} for um e-mail válido, um link de redefinição de senha foi enviado`
    );
  }

  async reset_password(req, res) {
    let user;
    const schema = Yup.object().shape({
      password: Yup.string().required('Senha é obrigatória'),
      password_confirmation: Yup.string()
        .required()
        .oneOf([Yup.ref('password'), null], 'As senhas devem coincidir'),
    });

    try {
      user = await UsersModel.find({ reset_token: req.params.token });
    } catch (e) {
      return res.status(400).json({ error: 'Erro ao redefinir senha.' });
    }

    try {
      await schema.validate(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.errors });
    }

    let { password } = req.body;
    password = await PasswordHasher.hash(password);

    try {
      await UsersModel.update(
        ['*'],
        { id: user[0].id },
        { password, reset_token: null }
      );
      return res.status(200).json('Senha alterada com sucesso!');
    } catch (e) {
      return res.status(400).json({ error: 'Erro ao redefinir senha.' });
    }
  }

  async creation_confirmation(req, res) {
    const confirmation_token = req.params.token;
    try {
      await UsersModel.update(
        ['id'],
        { confirmation_token },
        { active: true, confirmation_token: null }
      );
      return res.status(200).json('Conta ativada com sucesso.');
    } catch (e) {
      return res
        .status(503)
        .json('Falha ao estabelecer conexão com banco de dados!');
    }
  }
}

export default new Users();
