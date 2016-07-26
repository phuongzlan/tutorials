/*globals define, WebGMEGlobal, $, d3*/
/*jshint browser: true*/

/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Tue May 03 2016 14:32:33 GMT-0500 (Central Daylight Time).
 */

define(['jquery', 'd3', 'css!./styles/FSMSimulatorWidget.css'], function () {
    'use strict';

    var FSMSimulatorWidget,
        STATE_TYPES = {
            State: 'State',
            Initial: 'Initial',
            End: 'End'
        },
        WIDGET_CLASS = 'f-s-m-simulator';

    FSMSimulatorWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;

        this.nodes = {};
        this._initialize();
        this._simEl = null;
        this._simulator = null;

        this._logger.debug('ctor finished');
    };

    FSMSimulatorWidget.prototype._initialize = function () {
        var width = this._el.width(),
            height = this._el.height(),
            self = this;

        // set widget class
        this._el.addClass(WIDGET_CLASS);

        // Create indication header
        this._headerEl = $('<h3>');
        this._el.append(this._headerEl);
        this._headerEl.css('color', 'red');

        // Registering to events can be done with jQuery (as normal)
        //this._el.on('dblclick', function (event) {
        //    event.stopPropagation();
        //    event.preventDefault();
        //    self.onBackgroundDblClick();
        //});

        // Larger html snippets should ideally be defined in html-files and include using require-text (text!<path>).
        this._inputGroup = $(
            '<div class="input-group">' +
                '<span class="input-group-btn">' +
                    '<button class="btn btn-primary go-btn" type="button">Go!</button>' +
                '</span>' +
                '<input type="text" class="form-control" placeholder="Enter an event...">' +
                '<span class="input-group-btn">' +
                    '<button class="btn btn-warning start-btn" type="button">Initialize</button>' +
                '</span>' +
            '</div>');

        this._el.append(this._inputGroup);

        // Using jquery selector https://api.jquery.com/category/selectors/
        this._inputField = this._inputGroup.find('input');
        this._goBtn = this._inputGroup.find('.go-btn');
        this._startBtn = this._inputGroup.find('.start-btn');

        this._startBtn.on('click', function () {
            var stateId,
                stateData,
                key,
                helpMessage;

            if (self._simulator === null) {
                self._logger.error('Simulator not available at init');
                return;
            }

            // Clean up all state decoration.
            for (key in self._idToState) {
                stateData = self._idToState[key];
                stateData.d3Item.attr('fill', stateData.defaultColor);
            }

            self._simulator.initialize();

            stateId = self._simulator.getCurrentState().id;
            self._setState(stateId);

            helpMessage = 'Enter an event: ' + self._simulator.getPossibleEvents();
            self._inputField.attr('placeholder', helpMessage);
            self._inputField.attr('title', helpMessage);

            self._goBtn.prop('disabled', false);

        });

        this._goBtn.on('click', function () {
            var prevStateId,
                stateId,
                event,
                helpMessage;

            if (self._simulator === null) {
                self._logger.error('Simulator not available at go');
                return;
            }

            // Store the previous state.
            prevStateId = self._simulator.getCurrentState().id;

            // Input the event..
            event = self._inputField.val();
            self._simulator.enterEvent(event);

            // get the newly calculated state.
            stateId = self._simulator.getCurrentState().id;

            self._setState(stateId, prevStateId);
            if (self._simulator.atEnd === true) {
                helpMessage = 'At an end state, reinitialize the simulator.';
                self._goBtn.prop('disabled', true);
            } else {
                helpMessage = 'Enter an event: ' + self._simulator.getPossibleEvents();
            }

            self._inputField.attr('placeholder', helpMessage);
            self._inputField.attr('title', helpMessage);
            self._inputField.val('');
        });

        this._inputGroup.hide();

        // Create the d3
        this._svgD3 = d3.select(this._el[0]).append('svg')
            .attr('width', width)
            .attr('height', height);
    };

    FSMSimulatorWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');

        this._svgD3
            .attr('width', width)
            .attr('height', height);
    };

    FSMSimulatorWidget.prototype.populateGraph = function (fsmData) {
        var key,
            desc;

        this._logger.debug('fsmData', fsmData);
        this._idToState = {};
        this._idToTransition = {};

        for (key in fsmData.descriptors) {
            desc = fsmData.descriptors[key];
            if (STATE_TYPES.hasOwnProperty(desc.metaType)) {
                this._idToState[key] = {
                    desc: desc,
                    d3Item: null,
                    title: null,
                    defaultColor: null
                };
            } else if (desc.metaType === 'Transition' && desc.isConnection) {
                this._idToTransition[key] = {
                    desc: desc,
                    d3Item: null
                };
            }
        }

        this._addTransitionsToGraph();

        this._addStatesToGraph();

        this._embedSimulator(fsmData);
    };

    FSMSimulatorWidget.prototype._addStatesToGraph = function () {
        var key,
            stateData;

        for (key in this._idToState) {
            stateData = this._idToState[key];
            stateData.d3Item = this._svgD3.append('circle')
                .attr('cx', stateData.desc.position.x)
                .attr('cy', stateData.desc.position.y)
                .attr('r', 20)
                .attr('fill', 'gray');

            stateData.defaultColor = 'gray';

            if (stateData.desc.metaType === STATE_TYPES.Initial) {
                stateData.d3Item.attr('fill', 'green');
                stateData.defaultColor = 'green';
            } else if (stateData.desc.metaType === STATE_TYPES.End) {
                stateData.d3Item.attr('fill', 'purple');
                stateData.defaultColor = 'purple';
            }

            stateData.title = this._svgD3.append('text')
                .attr('x', stateData.desc.position.x - 20)
                .attr('y', stateData.desc.position.y - 25)
                .text(function () {
                    return stateData.desc.name;
                })
                .attr('fill', 'black');
        }
    };

    FSMSimulatorWidget.prototype._addTransitionsToGraph = function () {
        var key,
            transData,
            srcDesc,
            dstDesc;

        for (key in this._idToTransition) {
            transData = this._idToTransition[key];

            srcDesc = this._idToState[transData.desc.connects.srcId].desc;
            dstDesc = this._idToState[transData.desc.connects.dstId].desc;

            transData.d3Item = this._svgD3.append('line')
                .attr('x1', srcDesc.position.x)
                .attr('y1', srcDesc.position.y)
                .attr('x2', dstDesc.position.x)
                .attr('y2', dstDesc.position.y)
                .attr('stroke-width', 1)
                .attr('stroke', 'black');
        }
    };

    FSMSimulatorWidget.prototype._embedSimulator = function (fsmData) {
        var self = this;
        if (this._simEl === null) {
            if (typeof fsmData.simulatorUrl !== 'string') {
                self._headerEl.text('No simulator is attached.');
                return;
            }

            this._simEl = $('<iframe>', {
                id: 'FSMSimulator',
                src: fsmData.simulatorUrl,
                width: 0,
                height: 0
            });

            this._el.append(this._simEl);

            this._simEl.on('load', function () {
                var FSM = self._simEl[0].contentWindow.FSM;
                if (!FSM || FSM.hasOwnProperty('Simulator') === false) {
                    self._headerEl.text('Attached simulator not right format.');
                    return;
                }
                self._simulator = new FSM.Simulator(self._logger.debug);
                self._logger.debug('Simulator is loaded', self._simulator);

                // Update the UI controls displayed.
                self._inputGroup.show();
                self._goBtn.prop('disabled', true);
                self._inputField.prop('placeholder', 'Initialize simulator..');
            });
        }
    };

    FSMSimulatorWidget.prototype._setState = function (stateId, prevStateId) {
        var newStateData = this._idToState[stateId],
            prevStateData,
            delay = 0;

        if (prevStateId && prevStateId !== stateId) {
            prevStateData = this._idToState[prevStateId];
            prevStateData.d3Item.transition()
                .duration(300)
                .attr('r', 10)
                .delay(400)
                .transition()
                .duration(300)
                .attr('r', 20)
                .attr('fill', prevStateData.defaultColor);
            delay = 400;

        }

        newStateData.d3Item.transition()
            .delay(delay)
            .duration(300)
            .attr('r', 40)
            .delay(400)
            .transition()
            .duration(300)
            .attr('r', 20)
            .attr('fill', 'red');
    };

    // Adding/Removing/Updating items
    FSMSimulatorWidget.prototype.addNode = function (desc) {
        this._headerEl.text('Current model may have changed.');
    };

    FSMSimulatorWidget.prototype.removeNode = function (gmeId) {
        this._headerEl.text('Current model may have changed.');
    };

    FSMSimulatorWidget.prototype.updateNode = function (desc) {
        this._headerEl.text('Current model may have changed.');
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    FSMSimulatorWidget.prototype.onNodeClick = function (/*id*/) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    FSMSimulatorWidget.prototype.onBackgroundDblClick = function () {
        this._el.append('<div>Background was double-clicked!!</div>');
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    FSMSimulatorWidget.prototype.destroy = function () {
        this._goBtn.off('click');
        this._startBtn.off('click');
    };

    FSMSimulatorWidget.prototype.onActivate = function () {
        this._logger.debug('FSMSimulatorWidget has been activated');
    };

    FSMSimulatorWidget.prototype.onDeactivate = function () {
        this._logger.debug('FSMSimulatorWidget has been deactivated');
    };

    return FSMSimulatorWidget;
});
