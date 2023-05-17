import Extra from 'telegraf/extra.js';
import Markup from 'telegraf/markup.js';
import WizardScene from 'telegraf/scenes/wizard/index.js';
import {
  checkSceneOptions,
  createBug,
  getUserList,
  notion,
} from '../controllers/notion.js';
import imgbbController from '../controllers/imgbb.js';
import { getImg } from '../controllers/telegram.js';

export default async function () {
  return new WizardScene(
    //Название сцены
    'bugReport',
    //0. Название бага
    async (ctx) => {
      ctx.wizard.state.options = await checkSceneOptions(
        process.env.NOTION_OPTIONS_DB
      );
      // Начало нового этапа
      ctx.reply('Название бага');
      //Запись данных
      ctx.wizard.state.title = ctx.message.text;
      //Переход к следующему этапу
      if (!ctx.wizard.state.options.includes('приоритет')) {
        return ctx.wizard.selectStep(3);
      }
      return ctx.wizard.next();
    },
    //1.Выбор приоритета
    async (ctx) => {
      await ctx.reply(
        //Текст сообщения
        'Определите приоритет',
        //Клавиатура
        Markup.keyboard([['P1🔥', 'P2', 'P3']])
          .oneTime()
          .resize()
          .extra()
      );
      //Запись данных
      ctx.wizard.state.userId = ctx.message.from.id;
      //Переход к следующему этапу
      return ctx.wizard.next();
    },
    //2. Описание бага
    async (ctx) => {
      if (
        ctx.message.text !== 'P1🔥' &&
        ctx.message.text !== 'P2' &&
        ctx.message.text !== 'P3'
      ) {
        ctx.reply('Определите приоритет');
        return;
      } else {
        ctx.wizard.state.priority = ctx.message.text;
        ctx.reply(
          'Опишите баг в одном сообщении',
          Markup.keyboard([['Пропустить']])
            .oneTime()
            .resize()
            .extra()
        );
        //Переход к отправке бага без выбора исполнителя и добавления картинки
        console.log(ctx.wizard.state.options);
        if (
          !ctx.wizard.state.options.includes('запрос картинки') &&
          !ctx.wizard.state.options.includes('исполнители')
        ) {
          ctx.wizard.state.imgBlock = 'Пропустить';
          ctx.wizard.state.user = 'Пропустить';
          return ctx.wizard.selectStep(8);
        }
        //Переход к выбору исполнителя без добавления картинки
        if (!ctx.wizard.state.options.includes('запрос картинки')) {
          ctx.wizard.state.imgBlock = 'Пропустить';
          return ctx.wizard.selectStep(6);
        }
        //Переход к выбору картинки
        return ctx.wizard.selectStep(4);
      }
    },
    //2.1 Описание бага, если приоритет скипнут
    async (ctx) => {
      //Запись данных
      ctx.wizard.state.title = ctx.message.text;
      ctx.wizard.state.priority = 'Пропустить';
      ctx.reply(
        'Опишите баг в одном сообщении',
        Markup.keyboard([['Пропустить']])
          .oneTime()
          .resize()
          .extra()
      );
      //Переход к отправке бага без выбора исполнителя и добавления картинки
      console.log(ctx.wizard.state.options);
      if (
        !ctx.wizard.state.options.includes('запрос картинки') &&
        !ctx.wizard.state.options.includes('исполнители')
      ) {
        ctx.wizard.state.imgBlock = 'Пропустить';
        ctx.wizard.state.user = 'Пропустить';
        return ctx.wizard.selectStep(8);
      }

      //Пропуск выбора картинки
      if (!ctx.wizard.state.options.includes('запрос картинки')) {
        ctx.wizard.state.imgBlock = 'Пропустить';
        return ctx.wizard.selectStep(6);
      }
      //Переход к следующему этапу
      return ctx.wizard.next();
    },
    //3. Прикрепление картинки
    async (ctx) => {
      try {
        //Проверка данных
        if (ctx.message.text !== 'Пропустить') {
          //Запись данных
          ctx.wizard.state.textBlock = ctx.message.text;
        } else {
          //Запись данных
          ctx.wizard.state.textBlock = 'Пропустить';
        }
        //Новый вопрос
        ctx.reply(
          'Пришлите картинку',
          Markup.keyboard([['Пропустить']])
            .oneTime()
            .resize()
            .extra()
        );
        //Пропуск выбора исполнителя
        if (!ctx.wizard.state.options.includes('исполнители')) {
          ctx.wizard.state.user = 'Пропустить';
          return ctx.wizard.selectStep(9);
        }
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
    },
    //4. Выбор исполнителя
    async (ctx) => {
      try {
        //Проверка данных
        if (ctx.message.text !== 'Пропустить') {
          //Загрузка картинки, запись
          ctx.wizard.state.imgBlock = await imgbbController(
            await getImg(ctx.message.photo[2].file_id)
          );
          if (!ctx.message.photo) {
            ctx.reply('Пришлите картинку');
            return;
          }
        } else {
          ctx.wizard.state.imgBlock = 'Пропустить';
        }
        //Поиск имен исполнителей
        let users = (await getUserList()).map((i) => {
          return i.Name.title[0].plain_text;
        });
        ctx.reply(
          'Выберите исполнителя',
          Extra.markup(
            Markup.keyboard(users, {
              wrap: (btn, index) => index % 2 !== 0,
            }).resize()
          )
        );
        //Запись данных об исполнителях
        ctx.wizard.state.users = (await getUserList()).map((i) => {
          return i;
        });
        return ctx.wizard.selectStep(7);
      } catch (error) {
        //Обработка ошибок, перезапуск сценария
        ctx.reply(
          '❗️Ошибка',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        ctx.scene.leave();
        console.log(error);
      }
    },
    //4.1 Выбор исполнителя, если скипнули картинку
    async (ctx) => {
      try {
        //Проверка данных
        if (ctx.message.text !== 'Пропустить') {
          //Запись данных
          ctx.wizard.state.textBlock = ctx.message.text;
        } else {
          //Запись данных
          ctx.wizard.state.textBlock = 'Пропустить';
        }
        //Поиск имен исполнителей
        let users = (await getUserList()).map((i) => {
          return i.Name.title[0].plain_text;
        });
        ctx.reply(
          'Выберите исполнителя',
          Extra.markup(
            Markup.keyboard(users, {
              wrap: (btn, index) => index % 2 !== 0,
            }).resize()
          )
        );
        //Запись данных об исполнителях
        ctx.wizard.state.users = (await getUserList()).map((i) => {
          return i;
        });
        ctx.wizard.next();
      } catch (error) {
        //Обработка ошибок, перезапуск сценария
        ctx.reply(
          '❗️Ошибка',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        ctx.scene.leave();
        console.log(error);
      }
    },
    //Начало нового этапа
    async (ctx) => {
      try {
        //Запись выбранного исполнителя
        ctx.wizard.state.user = ctx.message.text;
        ctx.wizard.state.userId = await notion
          .search({ query: ctx.message.text })
          .then((res) => {
            return res.results[0].properties[
              'telegram ID'
            ].rich_text[0].plain_text.split(',');
          });
        await createBug(
          ctx.wizard.state.title,
          ctx.wizard.state.imgBlock,
          ctx.wizard.state.textBlock,
          ctx.wizard.state.priority,
          ctx.wizard.state.user
        );
        //Сообщение об успехе
        await ctx.reply(
          'Баг отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      } catch (error) {
        console.log(error);
        //Сообщение о не успехе
        ctx.reply(
          '❗️Баг не отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      }
    },
    //8. Отправка бага, без картинки, с текстом
    async (ctx) => {
      try {
        ctx.wizard.state.textBlock = ctx.message.text;
        //Создание страницы бага в ноушене
        await createBug(
          ctx.wizard.state.title,
          ctx.wizard.state.imgBlock,
          ctx.wizard.state.textBlock,
          ctx.wizard.state.priority,
          ctx.wizard.state.user
        );
        //Сообщение об успехе
        await ctx.reply(
          'Баг отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      } catch (error) {
        console.log(error);
        //Сообщение о не успехе
        ctx.reply(
          '❗️Баг не отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      }
    },
    //9. Отправка бага с картинкой без выбора исполнителя
    async (ctx) => {
      try {
        //Проверка данных
        if (ctx.message.text !== 'Пропустить') {
          //Загрузка картинки, запись
          ctx.wizard.state.imgBlock = await imgbbController(
            await getImg(ctx.message.photo[2].file_id)
          );
          if (!ctx.message.photo) {
            ctx.reply('Пришлите картинку');
            return;
          }
        } else {
          ctx.wizard.state.imgBlock = 'Пропустить';
        }
        //Создание страницы бага в ноушене
        await createBug(
          ctx.wizard.state.title,
          ctx.wizard.state.imgBlock,
          ctx.wizard.state.textBlock,
          ctx.wizard.state.priority,
          ctx.wizard.state.user
        );
        //Сообщение об успехе
        await ctx.reply(
          'Баг отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      } catch (error) {
        console.log(error);
        //Сообщение о не успехе
        ctx.reply(
          '❗️Баг не отправлен',
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        return ctx.scene.leave();
      }
    }
  );
}

export const newScene = () => {
  return new WizardScene(
    //Название сцены
    'Название',
    //Начало нового этапа
    (ctx) => {
      ctx.reply(
        //Текст сообщения
        'Текст',
        //Клавиатура
        Markup.keyboard([['Кнопка1', 'Кнопка2', 'Кнопка3']])
          .oneTime()
          .resize()
          .extra()
      );
      //Запись данных
      ctx.wizard.state.DATA = ctx.DATA;
      //Переход к следующему этапу
      return ctx.wizard.next();
    },
    //Новый этап
    async (ctx) => {}
  );
};
