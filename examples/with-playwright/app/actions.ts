"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();
const DASHBOARD_LIMIT = 5;

export const getItems = async () => {
  return prisma.todo.findMany({
    orderBy: { title: "asc" },
    take: DASHBOARD_LIMIT
  });
};

export const getTotal = async () => {
  return prisma.todo.count();
};

export const createItem = async (formData: FormData) => {
  await prisma.todo.create({
    data: { title: formData.get("title") as string }
  });
  revalidatePath("/");
};

export const deleteItem = async (id: number) => {
  await prisma.todo.delete({
    where: {
      id
    }
  });

  revalidatePath("/");
};
