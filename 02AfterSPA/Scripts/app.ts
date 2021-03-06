﻿/// <reference path="types/angularjs/angular.d.ts"/>
module TodoApp {

    var app: ng.IModule = angular.module("todoApp", []);

    // we send this down for sorting/filtering on the server 
    interface ITodoFilter {
        filterText: string;
        columnName: string;
        sortAscending: boolean; 
    }

    // didn't change the serializer so these come back Pascal case
    interface ITodoItem {
        Id: number;
        IsDone: boolean;
        Description: string;
        DueDate: string;
    }

    // declaring interfaces makes it easier to test 
    interface ITodoService {
        getItems(filter: ITodoFilter): ng.IPromise<ITodoItem[]>;
        updateItem(item: ITodoItem): ng.IPromise<ITodoItem>;
        deleteItem(item: ITodoItem): ng.IPromise<any>;
    }

    // also makes it easier to conform to the expected API 
    interface ITodoController {
        filter: ITodoFilter;
        items: ITodoItem[];
        overdue: (item: ITodoItem) => boolean;
        changeColumn: (columnName: string) => void;
        update: (item: ITodoItem) => void;
        loading: boolean;
        removeCompleted: () => void;
        noCompleted: () => boolean;
    }

    // module definitions provide insights into third-party APIs, 
    // even if they aren't written in TypeScript 
    interface IToggleColumn extends ng.IScope {
        toggle: () => void;
        changeColumn: (columnName: { colName: string }) => void;
        columnName: string;
        columnDescription: string;
        currentColumn: string;
        sortAscending: boolean;
    }

    // Typescript translates enums to objects you can access via value or string
    enum Columns {
        Id,
        Completed,
        Description,
        DueDate
    }

    // to make this available to other modules I'd export it, but because I
    // am just registering with Angular I keep it local to the module
    class TodoService implements ITodoService {
        constructor(private $q: ng.IQService, private $http: ng.IHttpService) {
            
        }

        // this let's Angular know what dependencies to inject even after your
        // code is minimized
        public static $inject: string[] = ["$q", "$http"];

        // promises are a way to handle asynchronous operations
        public getItems(filter: ITodoFilter): ng.IPromise<ITodoItem[]> {
            var defer = this.$q.defer();
            this.$http.get("/api/todo", {
                params: filter
            }).then((result) => {
                var list = result.data;
                defer.resolve(list);
            }, (err) => {
                defer.reject(err);
            });
            return defer.promise;
        }

        public updateItem(item: ITodoItem): ng.IPromise<ITodoItem> {
            var defer = this.$q.defer();
            this.$http.post("/api/todo", JSON.stringify(item)).then((result) => {
                defer.resolve(result);
            }, (err) => {
                defer.reject(err);
            });
            return defer.promise;
        }

        public deleteItem(item: ITodoItem): ng.IPromise<any> {
            var defer = this.$q.defer();
            this.$http.delete("/api/todo/" + item.Id)
                .then(() => defer.resolve(), (err) => defer.reject(err));
            return defer.promise;
        }
    }

    // this registers the service with dependency injection
    app.service("todoSvc", TodoService);

    // controllers provide the "glue" for data binding. Any public properties
    // can be accessed via declarative markup
    class TodoController implements ITodoController {
        constructor(private todoSvc: ITodoService) {
            this.filter = {
                filterText: "",
                columnName: Columns[Columns.DueDate],
                sortAscending: false
            };
            this.refresh();
        }

        public static $inject: string[] = ["todoSvc"];

        private refresh(): void {
            this.loading = true;
            this.todoSvc.getItems(this.filter).then(list => {
                this.items = list;
                this.loading = false;
            },(err) => {
                    alert(err);
                this.loading = false;
            });
        }

        public loading: boolean = false;

        public filter: ITodoFilter;

        public get filterText(): string {
            return this.filter.filterText;
        }

        public set filterText(value: string) {
            this.filter.filterText = value;
            this.refresh();
        }

        public items: ITodoItem[] = [];

        public overdue(todoItem: ITodoItem): boolean {
            var now = new Date(), due = new Date(todoItem.DueDate);
            return now > due;
        }

        public update(todoItem: ITodoItem): void {
            this.loading = true;
            this.todoSvc.updateItem(todoItem).then(() => {
                this.loading = false;
            }, (err) => {
                alert(err);
                this.loading = false;
            });
        }

        public changeColumn(columnName: string): void {            
            if (this.filter.columnName === columnName) {
                this.filter.sortAscending = !this.filter.sortAscending;
            } else {
                this.filter.columnName = columnName;
            }
            this.refresh();
        }

        public noCompleted(): boolean {
            var hasDone = false;
            angular.forEach(this.items, (item) => {
                if (item.IsDone) {
                    hasDone = true;
                }
            });
            return !hasDone;
        }

        public removeCompleted(): void {
            if (!confirm("Are you sure?")) {
                return;
            }
            var count: number = 0,
                checkCount = () => {
                    count -= 1;
                    if (count == 0) {
                        this.refresh();
                    }
                };
            this.loading = true;
            angular.forEach(this.items, (item) => {
                if (item.IsDone) {
                    count += 1;
                    this.todoSvc.deleteItem(item).then(checkCount, checkCount);
                }
            });
        }
    }

    app.controller("todoCtrl", TodoController);

    // directives provide reusable components. In this case the HTML for a header
    // and the logic to change the sort when the column header is clicked is all
    // encapsulated in a reusable component
    function columnToggle() : ng.IDirective {
        var directive: ng.IDirective = <ng.IDirective>{
            restrict: "E",
            scope: {
                sortAscending: "=",
                changeColumn: "&",
                currentColumn: "=",
                columnDescription: "@",
                columnName: "@"
            },
            link: (scope: IToggleColumn) => {
                scope.toggle = () => {
                    scope.changeColumn({ colName: scope.columnName });
                };
            },
            template: '<span ng-click="toggle()">{{columnDescription || columnName}}<span ng-if="currentColumn===columnName">' +
            '<span ng-if="sortAscending"> ^</span>' +
            '<span ng-if="!sortAscending"> v</span>' +
            '</span></span>'
        };
        return directive;
    }

    app.directive("columnToggle", columnToggle);
}