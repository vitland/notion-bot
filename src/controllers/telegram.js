import dotenv from 'dotenv';
dotenv.config();
import Stage from 'telegraf/stage.js';
import Telegraf from 'telegraf';
import Markup from 'telegraf/markup.js';
import session from 'telegraf/session.js';
import createBugScene from '../scenes/createBugScene.js';
import User from '../models/user.model.js';
import Task from '../models/task.model.js';

export const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(Telegraf.log());

export default {
  start: async () => {
    try {
      bot.start((ctx) =>
        ctx.reply(
          'Здесь можно зарепортит баг.\nСобщите ваш Telegram id ГДу - ' +
            ctx.from.id,
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        )
      );

      // Создается менеджер сцен
      const stage = new Stage();
      // Регистрируется сцена обработки бага
      stage.register(await createBugScene());
      // Регистрируется новая сцена
      // stage.register(await newScene());
      stage.command('cancel', (ctx) => {
        ctx.reply(
          'Здесь можно зарепортит баг.\nСобщите ваш Telegram id ГДу - ' +
            ctx.from.id,
          Markup.keyboard([['🐞Bug report']])
            .resize()
            .extra()
        );
        ctx.scene.leave();
      });

      bot.use(session());
      bot.use(stage.middleware());

      //Фраза после которой запускается сцена обработки бага
      bot.hears('🐞Bug report', (ctx) => {
        //Название сцены
        ctx.scene.enter('bugReport');
      });

      bot.start(console.log('bot rab'));
      bot.launch();
    } catch (error) {
      console.log(error);
    }
  },
};

export const getImg = async (fileId) => {
  return bot.telegram.getFile(fileId).catch((err) => {
    return err;
  });
};

//Рассылка уведомления о новой задаче
export const sendTaskTo = async (creator, progers, task) => {
  let text = `Новая задача\n<a href="${task.url}">${task.properties.Name.title[0].text.content}</a>`;
  switch (task.properties.Status.select.name) {
    
    case 'Validate':
      text = `На проверку <a href="${task.url}">${task.properties.Name.title[0].text.content}</a>`;
      let gameDevs = await User.find({userType: "GD"})
      gameDevs = gameDevs.map(gd => {
        return bot.telegram
        .sendMessage(gd.telegramId, text, { parse_mode: 'HTML' })

      });
      return Promise.all(gameDevs)
  }
};

export const editTaskMessage = (task) => {
  return task.taskMessage.forEach((taskMessage) => {
    bot.telegram
      .editMessageText(
        taskMessage.userId,
        taskMessage.messageId,
        taskMessage.messageId,
        'Задачу взяли'
      )
      .catch((err) => console.log(err));
  });
};

//Рассылка уведомления о новом баге
export const sendBugTo = async (creator, progers, bug) => {
  let text = `У вас баг🐞\n<a href="${bug.url}">${bug.properties.Name.title[0].text.content}</a>`;
  switch (bug.properties.Status.select.name) {
    case 'Not started':
      //Проверка кому отправить
      if (progers === 'sendToAll') {
        progers = await User.find({ name: { $ne: 'Пропустить' } });
      } else {
        progers = await User.find({
          name: {
            $in: progers.map((elem) => {
              return elem.name;
            }),
          },
        });
      }
        progers.forEach((proger) => {
          bot.telegram
            .sendMessage(proger.telegramId, text, { parse_mode: 'HTML' })
            .then(async (msg) => {
              Task.findOne({ taskId: bug.id }).then((bug) => {
                console.log(bug);
                bug.taskMessage.push({
                  messageId: msg.message_id,
                  userId: msg.chat.id,
                });
                bug.save();
              });
            })
            .catch((err) => console.log(err));
        });
      break;
    case 'Completed':
      text = `Баг закрыт\n<a href="${bug.url}">${bug.properties.Name.title[0].text.content}</a>`;
 let gameDevs = await User.find({userType: "GD"})
      gameDevs.forEach(gd => {
        bot.telegram
        .sendMessage(gd.telegramId, text, { parse_mode: 'HTML' })
        .catch((err) => console.log(err));
      });
      break;
    case 'In progress':
      if (!bug.properties['Исполнитель'].multi_select[0]) {
        editTaskMessage(await Task.findOne({ taskId: bug.id }));
      }
      break;
  }
};

export const send24hReminder = async (progers, bug) => {
  let text = `<a href="https://www.notion.so/">В багтрекере незакрытые баги</a>`;
  if (progers) {
    progers = await User.find({
      name: { $ne: 'Пропустить' },
      userType: { $ne: 'GD' },
      timeStamp: { $lte: Date.now() - 86400000 },
    });
  } else {
    progers = await User.find({
      userType: { $ne: 'GD' },
      name: {
        $in: progers,
      },
      timeStamp: { $lte: Date.now() - 86400000 },
    });
  }

  for (const proger of progers) {
    proger.timeStamp = Date.now();
    await bot.telegram
      .sendMessage(proger.telegramId, text, { parse_mode: 'HTML' }).then(() => proger.save())
      .catch((err) => console.log(err));
       
  }
};
