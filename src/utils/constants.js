export const userRolesEnum = {
    ADMIN : "admin",
    PROJECT_ADMIN : "project_admin",
    MEMBER : "member",
}

export const AvailableUserRole = Object.values(userRolesEnum);

export const TaskStatusNum = {
    TODO : "todo",
    IN_PROGRESS : "in_progress",
    DONE : "done"
};

export const AvailableTaskStaus = Object.values(TaskStatusNum); //stores key of above object in array