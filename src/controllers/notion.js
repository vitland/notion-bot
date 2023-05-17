import dotenv from 'dotenv';
dotenv.config();
import { Client } from '@notionhq/client';
import Task from '../models/task.model.js';
import User from '../models/user.model.js';
import {send24hReminder, sendBugTo, sendTaskTo } from './telegram.js';

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export const createBug = async (
  title,
  imgBlock,
  textBlock,
  priority,
  toWhoum,
  fromWho
) => {
  let proger;
  let children = [];
  let prior;

  if (toWhoum !== 'Пропустить') {
    proger = {
      multi_select: [
        {
          name: toWhoum,
        },
      ],
    };
  }
if (priority !== "Пропустить") {
  prior = {
    select: {
      name: priority,
    },
  }
}

  if (imgBlock !== 'Пропустить') {
    children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: {
          url: imgBlock.url,
        },
      },
    });
  }
  if (textBlock !== 'Пропустить') {
    children.unshift({
      type: 'paragraph',
      paragraph: {
        text: [
          {
            type: 'text',
            text: {
              content: textBlock,
            },
          },
        ],
      },
    });
  }
  return notion.pages.create({
    parent: {
      database_id: process.env.NOTION_BUGS_DB,
    },
    properties: {
      Name: {
        title: [
          {
            type: 'text',
            text: {
              content: `B${
                (
                  await notion.databases.query({
                    database_id: process.env.NOTION_BUGS_DB,
                  })
                ).results.length + 1
              } ${title}`,
            },
          },
        ],
      },
      Priority: prior,
      Исполнитель: proger,
      Status: {
        select: {
          name: 'Not started',
        },
      },
      Count: {
        type: 'relation',
        relation: [{ id: process.env.NOTION_COUNT_DB }],
      },
    },
    children,
  });
};

export const getUserList = async () => {
  return notion.databases
    .query({
      database_id: process.env.NOTION_USER_DB,
      filter: {
        and: [
          {
            property: 'telegram ID',
            rich_text: {
              is_not_empty: true,
            },
          },
          {
            property: 'Name',
            text: {
              is_not_empty: true,
            },
          },
        ],
      },
    })
    .then((result) => {
      return result.results.map((i) => {
        return i.properties;
      });
    })
    .catch((err) => {
      console.log(Date());
      console.log(err);
    });
};

export const newTasks = async (TASK_DB_TOKEN) => {
  try {
    let newTasks = await notion.databases.query({
      database_id: TASK_DB_TOKEN,
      filter: {
        property: 'Status',
        select: {
          equals: 'Not started',
          does_not_equal: 'Completed',
        },
      },
    });

    if (newTasks) {
      newTasks.results.forEach(async (elem) => {
        let taskPromise = await Task.findOne({ taskId: elem.id });
        if (taskPromise) {
          if (taskPromise.status !== elem.properties.Status.select.name) {
            taskPromise.status = elem.properties.Status.select.name;
            taskPromise.notification = 0;
          }

          taskPromise.save();
        } else {
          if (elem.properties.Status.select) {
            taskPromise = new Task({
              taskId: elem.id,
              status: elem.properties.Status.select.name,
              timeStamp: Date.now(),
              type: 'task',
            });
            taskPromise.save();
          }
        }
      });
    }
  } catch (error) {
    console.log(Date());
    console.log(error);
  }
};

export const checkTaskStatus = async (TASK_DB_TOKEN) => {
  try {
    let tasks = await notion.databases.query({
      database_id: TASK_DB_TOKEN,
      filter: {
        and: [
          {
            property: 'Status',
            select: {
              does_not_equal: 'Completed',
            },
          },
          {
            property: 'Status',
            select: {
              does_not_equal: 'Not started',
            },
          },
        ],
      },
    });
    if (tasks) {
      tasks.results.forEach(async (task) => {
        let taskPromise = await Task.findOne({ taskId: task.id });
        if (taskPromise) {
          if (
            task.properties.Status.select &&
            taskPromise.status !== task.properties.Status.select.name
          ) {
            taskPromise.taskId = task.id;
            taskPromise.status = task.properties.Status.select.name;
            if (task.properties['Кто взял?'].formula.string) {
              // console.log(elem.properties['Кто взял?'])
              taskPromise.proger =
                task.properties['Кто взял?'].formula.string.split('👉')[1];
            }
            if (task.properties['Исполнитель'].multi_select[0]) {
              taskPromise.proger = task.properties[
                'Исполнитель'
              ].multi_select.map((name) => {
                return name.name;
              });
            }
            sendTaskTo('null', 'null', task)
              .then(() => taskPromise.save())
              .catch((err) => console.log(err));
          }
        }
      });
    }
  } catch (error) {
    console.log(Date());
    console.log(error);
  }
};

export const newBugs = async (BUG_DB_TOKEN) => {
  try {
    let newTasks = await notion.databases.query({
      database_id: BUG_DB_TOKEN,
      filter: {
        property: 'Status',
        select: {
          equals: 'Not started',
          does_not_equal: 'Completed',
        },
      },
    });

    if (newTasks) {
      //24 часовое уведомление
      Task.find({
        taskId: {
          $in: newTasks.results.map((elem) => {
            return elem.id;
          }),
        },
        timeStamp: { $lte: Date.now() - 86400000 },
      }).then(async (bugs) => {
        for (const bug of bugs) {
          await send24hReminder(bug.assignedTo[0]);
        }
      });

      newTasks.results.forEach(async (elem) => {
        try {
          let taskPromise = await Task.findOne({ taskId: elem.id });
          if (taskPromise) {
            //Отправка уведомления из бота без задержки
            if (
              elem.properties['Last edit by'].last_edited_by.type === 'bot' &&
              taskPromise.notification === 0
            ) {
              if (!elem.properties['Исполнитель'].multi_select[0]) {
                sendBugTo(
                  elem.properties['Last edit by'].last_edited_by.name,
                  'sendToAll',
                  elem
                );
              } else {
                sendBugTo(
                  elem.properties['Last edit by'].last_edited_by.name,
                  elem.properties['Исполнитель'].multi_select,
                  elem
                );
              }
              //Счетчик уведомлений
              taskPromise.notification++;
            } else {
              //Задержка 5 минут перед отправкой уведомления
              if (
                taskPromise.timeStamp + 300000 < Date.now() &&
                taskPromise.notification === 0
              ) {
                if (!elem.properties['Исполнитель'].multi_select[0]) {
                  sendBugTo(
                    elem.properties['Last edit by'].last_edited_by.name,
                    'sendToAll',
                    elem
                  );
                } else {
                  sendBugTo(
                    elem.properties['Last edit by'].last_edited_by.name,
                    elem.properties['Исполнитель'].multi_select,
                    elem
                  );
                }
                taskPromise.notification++;
              }
            }

            if (taskPromise.status !== elem.properties.Status.select.name) {
              taskPromise.status = elem.properties.Status.select.name;
              taskPromise.timeStamp = Date.now();
              taskPromise.notification = 0;
              taskPromise.assignedTo = [];
              taskPromise.taskMessage = [];
            }
            //Запись информации об исполнителе
            taskPromise.assignedTo = [];
            taskPromise.assignedTo.push(
              elem.properties['Исполнитель'].multi_select.map(
                (elem) => elem.name
              )
            );

            taskPromise.save().catch((err) => console.log(err));
          } else {
            //Сохранение нового бага
            if (elem.properties.Status.select) {
              taskPromise = new Task({
                taskId: elem.id,
                status: elem.properties.Status.select.name,
                assignedTo: await elem.properties[
                  'Исполнитель'
                ].multi_select.map((elem) => elem.name),
                timeStamp: Date.now(),
                type: 'bug',
              });
              taskPromise.save();
            }
          }
        } catch (error) {
          console.log(Date());
          console.log(error);
        }
      });
    }
  } catch (error) {
    console.log(Date());
    console.log(error);
  }
};

export const checkBugStatus = async (BUG_DB_TOKEN) => {
  let tasks = await notion.databases
    .query({
      database_id: BUG_DB_TOKEN,
      filter: {
        property: 'Status',
        select: {
          does_not_equal: 'Not started',
        },
      },
    })
    .catch((error) => console.log(error));
  if (tasks) {
    tasks.results.forEach(async (task) => {
      try {
        let taskPromise = await Task.findOne({ taskId: task.id });
        if (taskPromise) {
          if (
            task.properties.Status.select &&
            taskPromise.status !== task.properties.Status.select.name
          ) {
            taskPromise.taskId = task.id;
            (taskPromise.status = task.properties.Status.select.name)
            if (task.properties['Кто взял?'].formula.string) {
              // console.log(elem.properties['Кто взял?'])
              taskPromise.proger =
                task.properties['Кто взял?'].formula.string.split('👉')[1];
            }
            if (task.properties['Исполнитель'].multi_select[0]) {
              taskPromise.proger = task.properties[
                'Исполнитель'
              ].multi_select.map((name) => {
                return name.name;
              });
            }
            taskPromise.save();
            sendBugTo('', '', task);
          }
        }
      } catch (error) {
        console.log(Date());
        console.log(error);
      }
    });
  }
};

export const getUsers = async (USER_DB_TOKEN, userType) => {
  try {
    let users = await notion.databases.query({
      database_id: USER_DB_TOKEN,
      filter: {
        and: [
          {
            property: 'telegram ID',
            rich_text: {
              is_not_empty: true,
            },
          },
          {
            property: 'Name',
            text: {
              is_not_empty: true,
            },
          },
        ],
      },
    });
    users.results.forEach(async (user) => {
      //Добавление юзеров
      let userPromise = await User.findOne({
        name: user.properties.Name.title[0].plain_text,
      });
      if (!userPromise) {
        userPromise = new User({
          name: user.properties.Name.title[0].plain_text,
          telegramId: user.properties['telegram ID'].rich_text[0].plain_text,
          timeStamp: 0,
          userType: userType,
        });
        userPromise.save();
      }
    });
    //Удаление юзеров
    await User.findOneAndRemove({
      telegramId: {
        $nin: users.results.map(
          (user) => user.properties['telegram ID'].rich_text[0].plain_text
        ),
      },
    });
  } catch (error) {
    console.log(Date());
    console.log(error);
  }
};

export const checkSceneOptions = async (OPTION_DB_TOKEN) => {
  let options = await notion.databases.query({
    database_id: OPTION_DB_TOKEN,
    filter: {
      property: 'Check',
      checkbox: {
        equals: true,
      },
    },
  });
  return (options = options.results.map((elem) => {
    return elem.properties.Name.title[0].plain_text;
  }));
};
